import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import sharp from 'sharp';
import * as dns from 'dns';
import { extractImageFromUrl } from '../src/image-utils';

// Mock dependencies
jest.mock('axios');
jest.mock('sharp');
jest.mock('dns', () => ({
  promises: {
    lookup: jest.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
  },
}));

// Mock console functions
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Define mock types
type MockedSharp = {
  metadata: jest.Mock;
  resize: jest.Mock;
  toBuffer: jest.Mock;
  jpeg: jest.Mock;
  png: jest.Mock;
  webp: jest.Mock;
  avif: jest.Mock;
  tiff: jest.Mock;
};

describe('URL Image Extraction Tests', () => {
  const compressedBuffer = Buffer.from('compressed');

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock sharp instance with properly typed methods
    const mockSharpInstance: MockedSharp = {
      // @ts-ignore
      metadata: jest.fn().mockResolvedValue({ width: 800, height: 600, format: 'png' }),
      resize: jest.fn().mockReturnThis(),
      // @ts-ignore
      toBuffer: jest.fn().mockResolvedValue(compressedBuffer),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      avif: jest.fn().mockReturnThis(),
      tiff: jest.fn().mockReturnThis(),
    };

    ((sharp as unknown) as jest.Mock).mockImplementation(() => mockSharpInstance);

    // Default axios mock: return a large image buffer
    const largeImageBuffer = Buffer.alloc(1000, 'x');
    (axios.get as jest.Mock).mockResolvedValue({
      data: largeImageBuffer,
      headers: { 'content-type': 'image/jpeg' },
    } as any);
  });

  it('validates URL format', async () => {
    const result = await extractImageFromUrl({ url: 'invalid-url' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: URL must start with http://');
  });

  it('successfully processes valid URLs', async () => {
    const result = await extractImageFromUrl({ url: 'https://example.com/image.png' });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(2);

    const metadata = JSON.parse(result.content[0].text as string);
    expect(metadata.width).toBeDefined();
    expect(metadata.height).toBeDefined();
    expect(metadata.format).toBeDefined();
    expect(metadata.size).toBeDefined();

    expect(result.content[1].type).toBe('image');
    expect(result.content[1].data).toBeDefined();

    expect(axios.get).toHaveBeenCalledWith('https://example.com/image.png',
      expect.objectContaining({
        responseType: 'arraybuffer',
        timeout: expect.any(Number),
      })
    );
  });

  it('handles network errors', async () => {
    (axios.get as jest.Mock).mockRejectedValue(new Error('Network error') as never);

    const result = await extractImageFromUrl({ url: 'https://example.com/image.png' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: Network error');
  });

  it('blocks requests to localhost', async () => {
    const result = await extractImageFromUrl({ url: 'http://localhost/image.png' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error:');
    expect(result.content[0].text).toContain('localhost');
  });

  it('blocks requests to private IP addresses', async () => {
    const result = await extractImageFromUrl({ url: 'http://192.168.1.1/image.png' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error:');
  });

  it('blocks IPv4-mapped IPv6 addresses that resolve to loopback', async () => {
    const result = await extractImageFromUrl({ url: 'http://[::ffff:127.0.0.1]/image.png' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error:');
  });

  it('compresses images from URLs', async () => {
    const result = await extractImageFromUrl({ url: 'https://example.com/large-image.jpg' });

    expect(result.isError).toBeUndefined();
    const metadata = JSON.parse(result.content[0].text as string);
    expect(metadata.size).toBeDefined();
  });

  it('blocks hostnames that resolve to private IPs', async () => {
    (dns.promises.lookup as jest.Mock).mockResolvedValue([
      { address: '10.0.0.1', family: 4 },
    ] as never);

    const result = await extractImageFromUrl({ url: 'https://evil.internal/image.png' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('resolves to a private/internal IP');
  });

  it('handles processImage failure from URL', async () => {
    // Reset DNS mock to return public IP (may have been overridden by previous test)
    (dns.promises.lookup as jest.Mock).mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ] as never);

    const mockErrorInstance: MockedSharp = {
      // @ts-ignore
      metadata: jest.fn().mockRejectedValue(new Error('Bad image data')),
      resize: jest.fn().mockReturnThis(),
      // @ts-ignore
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('x')),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      avif: jest.fn().mockReturnThis(),
      tiff: jest.fn().mockReturnThis(),
    };
    ((sharp as unknown) as jest.Mock).mockImplementation(() => mockErrorInstance);

    const result = await extractImageFromUrl({ url: 'https://example.com/bad.png' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Could not process image');
  });
});
