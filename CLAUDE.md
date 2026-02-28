# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) server that extracts images from files, URLs, and base64 strings, converts them to base64, and returns them for LLM analysis. Published to npm as `mcp-image-extractor`.

## Commands

```bash
npm run build        # Compile TypeScript → dist/ (also chmod +x dist/index.js)
npm run dev          # Run directly via ts-node (no build step)
npm start            # Run compiled server from dist/
npm run lint         # ESLint on .ts files
npm test             # Jest tests (--no-cache)
```

Run a single test file:
```bash
npx jest tests/compression.test.ts --no-cache
```

## Architecture

Two source files with clear separation:

- **`src/index.ts`** — MCP server setup. Registers three tools (`extract_image_from_file`, `extract_image_from_url`, `extract_image_from_base64`) using `@modelcontextprotocol/sdk`, validates inputs, and connects via stdio transport.

- **`src/image-utils.ts`** — All image processing logic. Three main async functions (`extractImageFromFile`, `extractImageFromUrl`, `extractImageFromBase64`) plus `compressImage` helper. Uses `sharp` for resize/compress, `axios` for URL fetching. All images are resized to max 512x512 and compressed before base64 encoding to optimize LLM context usage.

**Response format:** Every tool returns `McpToolResponse` with a `content` array containing a text block (JSON metadata: width, height, format, size) and an image block (base64 data + mimeType).

## Key Constants & Environment Variables

- `MAX_IMAGE_SIZE` — Max input image size in bytes (default: 10MB / 10485760)
- `ALLOWED_DOMAINS` — Comma-separated domain whitelist for URL extraction (default: empty = all allowed)
- Default resize target: 512x512 pixels

## Testing

Tests live in `tests/`. Jest config is in `jest.config.js` with `ts-jest` preset. Coverage is collected from `src/**/*.ts` excluding `index.ts`.

Tests heavily mock `sharp`, `axios`, and `fs` — the test files are split by extraction method:
- `file-tests.ts`, `url-tests.ts`, `base64-tests.ts` — imported by `image-utils.test.ts`
- `compression.test.ts` — compression-specific tests
- `index.test.ts` — server-level test

## Build & Publish

TypeScript compiles to CommonJS (ES2020 target) in `dist/`. The `prepublishOnly` hook auto-builds before `npm publish`. Only `dist/` is included in the published package. CI publishes via GitHub Actions on release or manual dispatch (`.github/workflows/publish.yml`).
