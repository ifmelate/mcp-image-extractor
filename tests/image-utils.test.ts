import { jest } from '@jest/globals';
import axios from 'axios';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('axios');
jest.mock('sharp');
jest.mock('fs');
jest.mock('path');
jest.mock('dns', () => ({
  promises: {
    lookup: jest.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
  },
}));

// Define mock types
type MockedSharp = {
  metadata: jest.Mock;
  resize: jest.Mock;
  toBuffer: jest.Mock;
  toFormat: jest.Mock;
  toFile: jest.Mock;
  jpeg: jest.Mock;
  png: jest.Mock;
  webp: jest.Mock;
  avif: jest.Mock;
  tiff: jest.Mock;
};

// Import the functions to test
import { 
  extractImageFromUrl, 
  extractImageFromBase64
} from '../src/image-utils';

describe('Image Processing Functions', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mocks
    (axios.get as jest.Mock).mockImplementation(() => {
      throw new Error('Network error');
    });
    
    // Create a mock sharp instance with properly typed methods
    const mockSharpInstance: MockedSharp = {
      // @ts-ignore - Ignore type error for mockResolvedValue
      metadata: jest.fn().mockResolvedValue({ width: 800, height: 600 }),
      resize: jest.fn().mockReturnThis(),
      // @ts-ignore - Ignore type error for mockResolvedValue
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('test')),
      toFormat: jest.fn().mockReturnThis(),
      // @ts-ignore - Ignore type error for mockResolvedValue
      toFile: jest.fn().mockResolvedValue(undefined),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      avif: jest.fn().mockReturnThis(),
      tiff: jest.fn().mockReturnThis(),
    };
    
    ((sharp as unknown) as jest.Mock).mockImplementation(() => mockSharpInstance);
    
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  describe('extractImageFromUrl', () => {
    it('should validate URL format', async () => {
      const result = await extractImageFromUrl({
        url: 'invalid-url',
      });

      expect(result.content[0].text).toContain('Error: URL must start with http://');
    });

    it('should handle network errors', async () => {
      const result = await extractImageFromUrl({
        url: 'https://untrusted-domain.com/image.jpg',
      });

      expect(result.content[0].text).toContain('Error: Network error');
    });
  });

  describe('extractImageFromBase64', () => {
    it('should process base64 images', async () => {
      // Mock Buffer.from to return a buffer
      jest.spyOn(Buffer, 'from').mockReturnValue(Buffer.from('test'));

      const result = await extractImageFromBase64({
        base64: 'base64-encoded-data',
        mime_type: 'image/png',
      });

      // The result should contain width and height
      expect(result.content[0].text).toContain('width');
      expect(result.content[0].text).toContain('height');
    });

    it('should handle invalid base64 data', async () => {
      // Mock Buffer.from to throw an error for empty base64
      jest.spyOn(Buffer, 'from').mockImplementation(() => {
        throw new Error('Invalid base64 string');
      });
      
      const result = await extractImageFromBase64({
        base64: '',
        mime_type: 'image/png',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error:');
    });
  });
}); 