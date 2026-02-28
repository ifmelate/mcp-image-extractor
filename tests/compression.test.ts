import { jest } from '@jest/globals';
import * as fs from 'fs';
import sharp from 'sharp';
import { extractImageFromFile } from '../src/image-utils';

// Mock dependencies to run in isolation
jest.mock('fs');
jest.mock('sharp');
// dns is not mocked here because extractImageFromFile does not perform SSRF checks
// (SSRF protection only applies to URL-based extraction)

// Mock console.warn and error
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

describe('Image Compression', () => {
  const testImageBuffer = Buffer.from('test-image-data');
  const compressedBuffer = Buffer.from('compressed');
  const originalSize = testImageBuffer.length;

  beforeEach(() => {
    jest.clearAllMocks();

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(testImageBuffer);
    (fs.statSync as jest.Mock).mockReturnValue({ size: originalSize });

    // Default mock: PNG image at 800x600 (wider than MAX_IMAGE_DIMENSION so resize fires)
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

  it('should compress PNG images', async () => {
    const result = await extractImageFromFile({ file_path: 'test_image.png' });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const metadata = JSON.parse(result.content[0].text as string);
    expect(metadata.size).toBeLessThan(originalSize);

    // Format comes from sharp metadata, so .png() compression should be invoked
    const sharpInstance = (sharp as unknown as jest.Mock).mock.results[0].value as MockedSharp;
    expect(sharpInstance.png).toHaveBeenCalled();
  });

  it('should compress JPEG images', async () => {
    // Override mock to report JPEG format
    const mockJpegInstance: MockedSharp = {
      // @ts-ignore
      metadata: jest.fn().mockResolvedValue({ width: 800, height: 600, format: 'jpeg' }),
      resize: jest.fn().mockReturnThis(),
      // @ts-ignore
      toBuffer: jest.fn().mockResolvedValue(compressedBuffer),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      avif: jest.fn().mockReturnThis(),
      tiff: jest.fn().mockReturnThis(),
    };
    ((sharp as unknown) as jest.Mock).mockImplementation(() => mockJpegInstance);

    const result = await extractImageFromFile({ file_path: 'test_image.jpg' });

    expect(result.content).toBeDefined();
    const metadata = JSON.parse(result.content[0].text as string);
    expect(metadata.size).toBeLessThan(originalSize);

    const sharpInstance = (sharp as unknown as jest.Mock).mock.results[0].value as MockedSharp;
    expect(sharpInstance.jpeg).toHaveBeenCalled();
  });

  it('should compress WebP images', async () => {
    const mockWebpInstance: MockedSharp = {
      // @ts-ignore
      metadata: jest.fn().mockResolvedValue({ width: 800, height: 600, format: 'webp' }),
      resize: jest.fn().mockReturnThis(),
      // @ts-ignore
      toBuffer: jest.fn().mockResolvedValue(compressedBuffer),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      avif: jest.fn().mockReturnThis(),
      tiff: jest.fn().mockReturnThis(),
    };
    ((sharp as unknown) as jest.Mock).mockImplementation(() => mockWebpInstance);

    const result = await extractImageFromFile({ file_path: 'test_image.webp' });

    expect(result.content).toBeDefined();
    const metadata = JSON.parse(result.content[0].text as string);
    expect(metadata.size).toBeLessThan(originalSize);

    const sharpInstance = (sharp as unknown as jest.Mock).mock.results[0].value as MockedSharp;
    expect(sharpInstance.webp).toHaveBeenCalled();
  });

  it('should compress AVIF images', async () => {
    const mockAvifInstance: MockedSharp = {
      // @ts-ignore
      metadata: jest.fn().mockResolvedValue({ width: 800, height: 600, format: 'avif' }),
      resize: jest.fn().mockReturnThis(),
      // @ts-ignore
      toBuffer: jest.fn().mockResolvedValue(compressedBuffer),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      avif: jest.fn().mockReturnThis(),
      tiff: jest.fn().mockReturnThis(),
    };
    ((sharp as unknown) as jest.Mock).mockImplementation(() => mockAvifInstance);

    const result = await extractImageFromFile({ file_path: 'test_image.avif' });

    expect(result.content).toBeDefined();
    const metadata = JSON.parse(result.content[0].text as string);
    expect(metadata.size).toBeLessThan(originalSize);

    const sharpInstance = (sharp as unknown as jest.Mock).mock.results[0].value as MockedSharp;
    expect(sharpInstance.avif).toHaveBeenCalled();
  });

  it('should compress TIFF images', async () => {
    const mockTiffInstance: MockedSharp = {
      // @ts-ignore
      metadata: jest.fn().mockResolvedValue({ width: 800, height: 600, format: 'tiff' }),
      resize: jest.fn().mockReturnThis(),
      // @ts-ignore
      toBuffer: jest.fn().mockResolvedValue(compressedBuffer),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      avif: jest.fn().mockReturnThis(),
      tiff: jest.fn().mockReturnThis(),
    };
    ((sharp as unknown) as jest.Mock).mockImplementation(() => mockTiffInstance);

    const result = await extractImageFromFile({ file_path: 'test_image.tiff' });

    expect(result.content).toBeDefined();
    const metadata = JSON.parse(result.content[0].text as string);
    expect(metadata.size).toBeLessThan(originalSize);

    const sharpInstance = (sharp as unknown as jest.Mock).mock.results[0].value as MockedSharp;
    expect(sharpInstance.tiff).toHaveBeenCalled();
  });

  it('should handle unknown format with default compression', async () => {
    const mockGifInstance: MockedSharp = {
      // @ts-ignore
      metadata: jest.fn().mockResolvedValue({ width: 800, height: 600, format: 'gif' }),
      resize: jest.fn().mockReturnThis(),
      // @ts-ignore
      toBuffer: jest.fn().mockResolvedValue(compressedBuffer),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      avif: jest.fn().mockReturnThis(),
      tiff: jest.fn().mockReturnThis(),
    };
    ((sharp as unknown) as jest.Mock).mockImplementation(() => mockGifInstance);

    const result = await extractImageFromFile({ file_path: 'test_image.gif' });

    expect(result.content).toBeDefined();
    expect(result.isError).toBeUndefined();
  });

  it('should fall back gracefully when compression fails', async () => {
    // Mock: resize succeeds, compression toBuffer rejects, final metadata succeeds
    const mockErrorInstance: MockedSharp = {
      // @ts-ignore
      metadata: jest.fn().mockResolvedValue({ width: 800, height: 600, format: 'jpeg' }),
      resize: jest.fn().mockReturnThis(),
      toBuffer: jest.fn()
        // @ts-ignore
        .mockResolvedValueOnce(testImageBuffer)       // resize step
        // @ts-ignore
        .mockRejectedValueOnce(new Error('Compression failed'))  // compress step
        // @ts-ignore
        .mockResolvedValue(testImageBuffer),          // final metadata (via separate sharp call)
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      avif: jest.fn().mockReturnThis(),
      tiff: jest.fn().mockReturnThis(),
    };
    ((sharp as unknown) as jest.Mock).mockImplementation(() => mockErrorInstance);

    const result = await extractImageFromFile({ file_path: 'test_image.jpg' });

    // Function should still return a valid result despite compression failure
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.isError).toBeUndefined();

    // Compression fallback should have been logged
    expect(console.warn).toHaveBeenCalled();
  });
});
