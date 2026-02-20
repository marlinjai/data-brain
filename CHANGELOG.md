# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-20

### Added

- Initial release of Data Brain — structured data as a service
- `@data-brain/shared` — Types, Zod validation schemas, and constants
- `@data-brain/api` — Cloudflare Workers API (Hono) with full DatabaseAdapter coverage
  - Tenant management with API key authentication (SHA-256 hashed)
  - Admin routes for tenant provisioning
  - 43 DatabaseAdapter methods exposed over HTTP
  - Table, column, row, view, relation, select option, and file reference routes
  - Bulk create/delete/archive rows
  - Ownership verification on all resource access
  - D1 migration for tenants and data tables
- `@marlinjai/data-brain-sdk` — TypeScript SDK
  - Full DatabaseAdapter method coverage
  - Automatic retry with exponential backoff
  - Typed error hierarchy (NotFoundError, ValidationError, etc.)
  - Dual CJS/ESM build

### Security

- API keys generated with `crypto.getRandomValues` (not Math.random)
- Admin key comparison uses `crypto.subtle.timingSafeEqual`
- Bulk operations verify ownership of all rows before proceeding
- Batch endpoint disabled pending per-operation tenant isolation

[0.1.0]: https://github.com/marlinjai/data-brain/releases/tag/v0.1.0
