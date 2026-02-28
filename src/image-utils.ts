import axios from 'axios';
import sharp from 'sharp';
import * as fs from 'fs';
import * as dns from 'dns';
import * as net from 'net';

// Configuration
const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || '10485760', 10); // 10MB default
const ALLOWED_DOMAINS = process.env.ALLOWED_DOMAINS ? process.env.ALLOWED_DOMAINS.split(',') : [];
const MAX_IMAGE_DIMENSION = parseInt(process.env.MAX_IMAGE_DIMENSION || '512', 10);
const URL_FETCH_TIMEOUT_MS = parseInt(process.env.URL_FETCH_TIMEOUT_MS || '30000', 10);

const FORMAT_TO_MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg:  'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
  svg:  'image/svg+xml',
  avif: 'image/avif',
  tiff: 'image/tiff',
  heif: 'image/heif',
};

// Type definitions
export type ExtractImageFromFileParams = {
  file_path: string;
};

export type ExtractImageFromUrlParams = {
  url: string;
};

export type ExtractImageFromBase64Params = {
  base64: string;
  mime_type: string;
};

// MCP SDK expects this specific format for tool responses
export type McpToolResponse = {
  [x: string]: unknown;
  content: (
    | { [x: string]: unknown; type: "text"; text: string; }
    | { [x: string]: unknown; type: "image"; data: string; mimeType: string; }
    | {
        [x: string]: unknown;
        type: "resource";
        resource: {
          [x: string]: unknown;
          text: string;
          uri: string;
          mimeType?: string;
        } | {
          [x: string]: unknown;
          uri: string;
          blob: string;
          mimeType?: string;
        };
      }
  )[];
  _meta?: Record<string, unknown>;
  isError?: boolean;
};

type ProcessedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
  wasResized: boolean;
  originalWidth: number;
  originalHeight: number;
};

// Apply format-specific compression to a buffer
async function compressForFormat(buffer: Buffer, format: string): Promise<Buffer> {
  const s = sharp(buffer);
  switch (format) {
    case 'jpeg':
    case 'jpg':
      return s.jpeg({ quality: 80 }).toBuffer();
    case 'png':
      return s.png({ quality: 80, compressionLevel: 9 }).toBuffer();
    case 'webp':
      return s.webp({ quality: 80 }).toBuffer();
    case 'avif':
      return s.avif({ quality: 80 }).toBuffer();
    case 'tiff':
      return s.tiff({ quality: 80 }).toBuffer();
    default:
      return s.toBuffer();
  }
}

// Resize and compress in sequence, with compression fallback
async function processImage(imageBuffer: Buffer, formatHint = ''): Promise<ProcessedImage> {
  const inputMetadata = await sharp(imageBuffer).metadata();
  const originalWidth = inputMetadata.width ?? 0;
  const originalHeight = inputMetadata.height ?? 0;
  const format = (inputMetadata.format || formatHint).toLowerCase();

  let workingBuffer = imageBuffer;
  let wasResized = false;

  if (
    (originalWidth > 0 && originalWidth > MAX_IMAGE_DIMENSION) ||
    (originalHeight > 0 && originalHeight > MAX_IMAGE_DIMENSION)
  ) {
    wasResized = true;
    workingBuffer = await sharp(imageBuffer)
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();
  }

  let finalBuffer = workingBuffer;
  try {
    finalBuffer = await compressForFormat(workingBuffer, format);
  } catch (compressionError) {
    console.warn('Compression warning, using pre-compression buffer:', compressionError);
  }

  const finalMetadata = await sharp(finalBuffer).metadata();
  return {
    buffer: finalBuffer,
    width: finalMetadata.width ?? 0,
    height: finalMetadata.height ?? 0,
    format: finalMetadata.format ?? format,
    size: finalBuffer.length,
    wasResized,
    originalWidth,
    originalHeight,
  };
}

// SSRF protection — exported for direct unit testing
export function isPrivateIP(ip: string): boolean {
  const ipv4Ranges = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\.0\.0\.0/,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  ];
  const ipv6Ranges = [/^::1$/, /^fc/i, /^fd/i, /^fe[89ab]/i, /^::$/, /^(0:){7}0$/];
  if (net.isIPv4(ip)) return ipv4Ranges.some(r => r.test(ip));
  if (net.isIPv6(ip)) {
    // IPv4-mapped IPv6 dotted form: ::ffff:x.x.x.x
    const v4Dotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (v4Dotted) return ipv4Ranges.some(r => r.test(v4Dotted[1]));
    // IPv4-mapped IPv6 hex form: ::ffff:XXXX:XXXX (e.g. ::ffff:7f00:1 = 127.0.0.1)
    const v4Hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (v4Hex) {
      const high = parseInt(v4Hex[1], 16);
      const low = parseInt(v4Hex[2], 16);
      const embedded = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
      return ipv4Ranges.some(r => r.test(embedded));
    }
    return ipv6Ranges.some(r => r.test(ip));
  }
  return false;
}

export async function checkSSRFRisk(urlString: string): Promise<string | null> {
  const urlObj = new URL(urlString);
  const hostname = urlObj.hostname;

  // URL.hostname wraps IPv6 literals in brackets (e.g. [::1]); strip them for net.isIP checks
  const host = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  if (host === 'localhost') {
    return `Hostname "${host}" is not allowed`;
  }

  if (net.isIP(host)) {
    return isPrivateIP(host)
      ? `IP address "${host}" is not allowed (private/internal range)`
      : null;
  }

  // NOTE: Pre-request DNS resolution has an inherent TOCTOU (time-of-check/time-of-use) race
  // condition — a DNS rebinding attack can return a different IP between this check and the
  // actual axios request. This check provides defense-in-depth but is not a complete mitigation.
  // For high-security deployments, also validate the resolved IP at the socket level.
  try {
    const addresses = await dns.promises.lookup(host, { all: true });
    for (const { address } of addresses) {
      if (isPrivateIP(address)) {
        return `Hostname "${host}" resolves to a private/internal IP address`;
      }
    }
  } catch {
    // DNS failure — let axios handle it naturally
  }

  return null;
}

// Extract image from file
export async function extractImageFromFile(params: ExtractImageFromFileParams): Promise<McpToolResponse> {
  try {
    const { file_path } = params;

    if (!fs.existsSync(file_path)) {
      return {
        content: [{ type: "text", text: `Error: File ${file_path} does not exist` }],
        isError: true,
      };
    }

    const rawBuffer = fs.readFileSync(file_path);
    if (rawBuffer.length > MAX_IMAGE_SIZE) {
      return {
        content: [{ type: "text", text: `Error: Image size exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes` }],
        isError: true,
      };
    }

    let processed: ProcessedImage;
    try {
      processed = await processImage(rawBuffer);
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: Could not process image - ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }

    const mimeType = FORMAT_TO_MIME[processed.format] ?? 'application/octet-stream';
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            width: processed.width,
            height: processed.height,
            format: processed.format,
            size: processed.size,
            original_width: processed.originalWidth,
            original_height: processed.originalHeight,
            was_resized: processed.wasResized,
          }),
        },
        {
          type: "image",
          data: processed.buffer.toString('base64'),
          mimeType,
        },
      ],
    };
  } catch (error: unknown) {
    console.error('Error processing image file:', error);
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
}

// Extract image from URL
export async function extractImageFromUrl(params: ExtractImageFromUrlParams): Promise<McpToolResponse> {
  try {
    const { url } = params;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return {
        content: [{ type: "text", text: "Error: URL must start with http:// or https://" }],
        isError: true,
      };
    }

    const ssrfError = await checkSSRFRisk(url);
    if (ssrfError) {
      return {
        content: [{ type: "text", text: `Error: ${ssrfError}` }],
        isError: true,
      };
    }

    if (ALLOWED_DOMAINS.length > 0) {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const isAllowed = ALLOWED_DOMAINS.some((allowedDomain: string) =>
        domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)
      );
      if (!isAllowed) {
        return {
          content: [{ type: "text", text: `Error: Domain ${domain} is not in the allowed domains list` }],
          isError: true,
        };
      }
    }

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      maxContentLength: MAX_IMAGE_SIZE,
      timeout: URL_FETCH_TIMEOUT_MS,
    });

    const rawBuffer = Buffer.from(response.data);
    let processed: ProcessedImage;
    try {
      processed = await processImage(rawBuffer);
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: Could not process image - ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }

    const contentType = response.headers['content-type']?.split(';')[0]?.trim();
    const mimeType = FORMAT_TO_MIME[processed.format] ?? contentType ?? 'application/octet-stream';
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            width: processed.width,
            height: processed.height,
            format: processed.format,
            size: processed.size,
            original_width: processed.originalWidth,
            original_height: processed.originalHeight,
            was_resized: processed.wasResized,
          }),
        },
        {
          type: "image",
          data: processed.buffer.toString('base64'),
          mimeType,
        },
      ],
    };
  } catch (error: unknown) {
    console.error('Error processing image from URL:', error);
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
}

// Extract image from base64
export async function extractImageFromBase64(params: ExtractImageFromBase64Params): Promise<McpToolResponse> {
  try {
    const { base64, mime_type } = params;

    let rawBuffer: Buffer;
    try {
      rawBuffer = Buffer.from(base64, 'base64');
      if (rawBuffer.length === 0) {
        throw new Error("Decoded to empty buffer");
      }
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: Invalid base64 string - ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }

    if (rawBuffer.length > MAX_IMAGE_SIZE) {
      return {
        content: [{ type: "text", text: `Error: Image size exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes` }],
        isError: true,
      };
    }

    const formatHint = mime_type.split('/')[1] ?? '';
    let processed: ProcessedImage;
    try {
      processed = await processImage(rawBuffer, formatHint);
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: Could not process image - ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }

    const mimeType = FORMAT_TO_MIME[processed.format] ?? mime_type;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            width: processed.width,
            height: processed.height,
            format: processed.format,
            size: processed.size,
            original_width: processed.originalWidth,
            original_height: processed.originalHeight,
            was_resized: processed.wasResized,
          }),
        },
        {
          type: "image",
          data: processed.buffer.toString('base64'),
          mimeType,
        },
      ],
    };
  } catch (error: unknown) {
    console.error('Error processing base64 image:', error);
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
}
