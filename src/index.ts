#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  extractImageFromFile,
  extractImageFromUrl,
  extractImageFromBase64
} from './image-utils';

dotenv.config();

// Works correctly from both src/ (ts-node) and dist/ (compiled) since both are one level below project root
const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

// Create an MCP server
const server = new McpServer({
  name: "mcp-image-extractor",
  description: "MCP server for analyzing of images from files, URLs, and base64 data for visual content understanding, text extraction (OCR), and object recognition in screenshots and photos",
  version
});

// Add extract_image_from_file tool
server.tool(
  "extract_image_from_file",
  "Extract and analyze images from local file paths. Supports visual content understanding, OCR text extraction, and object recognition for screenshots, photos, diagrams, and documents.",
  {
    file_path: z.string().describe("Path to the image file to analyze (supports screenshots, photos, diagrams, and documents in PNG, JPG, GIF, WebP formats)"),
  },
  async (args) => {
    return await extractImageFromFile(args);
  }
);

// Add extract_image_from_url tool
server.tool(
  "extract_image_from_url",
  "Extract and analyze images from web URLs. Perfect for analyzing web screenshots, online photos, diagrams, or any image accessible via HTTP/HTTPS for visual content analysis and text extraction.",
  {
    url: z.string().describe("URL of the image to analyze for visual content, text extraction, or object recognition (supports web screenshots, photos, diagrams)"),
  },
  async (args) => {
    return await extractImageFromUrl(args);
  }
);

// Add extract_image_from_base64 tool
server.tool(
  "extract_image_from_base64",
  "Extract and analyze images from base64-encoded data. Ideal for processing screenshots from clipboard, dynamically generated images, or images embedded in applications without requiring file system access.",
  {
    base64: z.string().describe("Base64-encoded image data to analyze (useful for screenshots, images from clipboard, or dynamically generated visuals)"),
    mime_type: z.string().default("image/png").describe("MIME type of the image (e.g., image/png, image/jpeg)"),
  },
  async (args) => {
    return await extractImageFromBase64(args);
  }
);

// Start the server using stdio transport
const transport = new StdioServerTransport();
server.connect(transport).catch((error: unknown) => {
  console.error('Error starting MCP server:', error);
  process.exit(1);
});

console.error('MCP Image Extractor server started in stdio mode');
