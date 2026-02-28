import { jest } from '@jest/globals';
import * as fs from 'fs';
import sharp from 'sharp';
import { extractImageFromFile } from '../src/image-utils';

// Mock all I/O dependencies for deterministic unit tests
jest.mock('fs');
jest.mock('sharp');

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

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

describe('Image Extractor File Tests', () => {
  const testImageBuffer = Buffer.from('test-image-data');
  const compressedBuffer = Buffer.from('compressed');

  beforeEach(() => {
    jest.clearAllMocks();

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(testImageBuffer);

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
  });

  it('extracts image from file', async () => {
    const result = await extractImageFromFile({ file_path: '/test/image.png' });

    expect(result.content).toHaveLength(2);
    const metadata = JSON.parse(result.content[0].text as string);
    expect(metadata.width).toBeDefined();
    expect(metadata.height).toBeDefined();
    expect(metadata.format).toBeDefined();
    expect(metadata.size).toBeDefined();
    expect(result.content[1].type).toBe('image');
    expect(result.content[1].data).toBeDefined();
    expect(result.content[1].mimeType).toBeDefined();
  });

  it('handles non-existent files', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const result = await extractImageFromFile({ file_path: 'non-existent-file.png' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('does not exist');
  });

  it('handles file reading errors', async () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Simulated read error');
    });

    const result = await extractImageFromFile({ file_path: 'error-file.png' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error:');
  });

  it('returns base64-encoded image data', async () => {
    const result = await extractImageFromFile({ file_path: '/test/image.png' });

    expect(result.content[1].data).toBeDefined();
    expect(typeof result.content[1].data).toBe('string');
    const base64Data = result.content[1].data as string;
    expect(base64Data.length % 4).toBe(0);
  });

  it('rejects files exceeding MAX_IMAGE_SIZE', async () => {
    // Create a buffer larger than 10MB
    const oversizedBuffer = Buffer.alloc(10485761, 'x');
    (fs.readFileSync as jest.Mock).mockReturnValue(oversizedBuffer);

    const result = await extractImageFromFile({ file_path: '/test/huge.png' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('exceeds maximum allowed size');
  });

  it('handles processImage failure gracefully', async () => {
    const mockErrorInstance: MockedSharp = {
      // @ts-ignore
      metadata: jest.fn().mockRejectedValue(new Error('Corrupt image')),
      resize: jest.fn().mockReturnThis(),
      // @ts-ignore
      toBuffer: jest.fn().mockResolvedValue(compressedBuffer),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      avif: jest.fn().mockReturnThis(),
      tiff: jest.fn().mockReturnThis(),
    };
    ((sharp as unknown) as jest.Mock).mockImplementation(() => mockErrorInstance);

    const result = await extractImageFromFile({ file_path: '/test/corrupt.png' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Could not process image');
  });

  it('reports compressed size in metadata', async () => {
    const result = await extractImageFromFile({ file_path: '/test/image.png' });

    const metadata = JSON.parse(result.content[0].text as string);
    expect(metadata.size).toBe(compressedBuffer.length);
    expect(metadata.size).toBeLessThan(testImageBuffer.length);
  });
});
