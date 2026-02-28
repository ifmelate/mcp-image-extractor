# Changelog

## [2.0.0] - 2026-02-28

### Breaking Changes

- **Removed deprecated parameters** — `resize`, `max_width`, and `max_height` have been removed from all three tools (`extract_image_from_file`, `extract_image_from_url`, `extract_image_from_base64`). Images are always resized to `MAX_IMAGE_DIMENSION` (default 512px) automatically.
- **MIME type derivation changed** — Response `mimeType` is now derived from sharp's detected image format rather than file extension or HTTP `content-type` header. The HTTP header is used as a fallback for URL extraction when the format is unrecognized.

### Added

- **SSRF protection for URL extraction** — Blocks requests to localhost, private/internal IP ranges (RFC1918, loopback, link-local, CGNAT), and hostnames that resolve to private IPs via DNS. Covers IPv4, IPv6, and IPv4-mapped IPv6 addresses.
- **Configurable environment variables** — `MAX_IMAGE_DIMENSION` (default: 512) and `URL_FETCH_TIMEOUT_MS` (default: 30000) are now configurable via environment variables.
- **Response metadata enrichment** — Tool responses now include `original_width`, `original_height`, and `was_resized` fields in the JSON metadata block.
- **Dynamic version** — Server version is now read from `package.json` at startup instead of being hardcoded.
- **SSRF test suite** — Comprehensive unit tests for `isPrivateIP` and `checkSSRFRisk` covering IPv4, IPv6, IPv4-mapped IPv6, DNS resolution, and edge cases.
- **`.env.example`** — Documents all supported environment variables.

### Changed

- **Unified `processImage()` pipeline** — Replaced duplicated resize/compress logic across all three extraction functions with a single pipeline. Handles metadata extraction, resizing, and format-specific compression with graceful fallback.
- **Test restructuring** — Migrated test helpers (`file-tests.ts`, `url-tests.ts`, `base64-tests.ts`) to proper `.test.ts` files with isolated mocks.
- **Startup log uses stderr** — `console.error` instead of `console.log` for MCP stdio transport compatibility.

### Fixed

- **`require('../package.json')` path resolution** — Replaced with `readFileSync` + `__dirname` approach that works in both `ts-node` (dev) and compiled (`dist/`) contexts.

### Removed

- **Unused dev dependencies** — Removed `@types/axios` and `@types/dotenv` (both ship their own types).
- **`coverage/` from git tracking** — Added to `.gitignore`.

## [1.1.1] - 2025-01-01

### Changed

- Version bump with minor fixes.

## [1.1.0] - 2025-01-01

### Added

- Tool descriptions for all three MCP tools to improve LLM agent discoverability.

## [1.0.0] - 2025-01-01

### Added

- Initial release with `extract_image_from_file`, `extract_image_from_url`, and `extract_image_from_base64` tools.
- Image compression and resizing for optimal LLM context usage.
- Domain allowlist support via `ALLOWED_DOMAINS` environment variable.
