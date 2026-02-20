---
title: Design Document
description: Original design specification for Data Brain
order: 1
---

# Design Document

The full design specification for Data Brain is maintained in the ERP suite root at `docs/plans/2026-02-20-data-brain-design.md`.

## Summary

Data Brain was designed as "structured data as a service" -- the database equivalent of Storage Brain. The core idea is to expose the full `DatabaseAdapter` interface (43 methods) over HTTP, allowing any client application to use a Notion-like database backend without managing its own database.

### Key Design Goals

1. **Full DatabaseAdapter coverage** -- Every method from `@marlinjai/data-table-core` should be accessible over HTTP
2. **Multi-tenant isolation** -- Each tenant gets a workspace scoped by their API key, with no cross-tenant data access
3. **Edge-first** -- Built on Cloudflare Workers + D1 for minimal latency worldwide
4. **Drop-in compatibility** -- The SDK and adapter allow Data Brain to be a transparent backend for `@marlinjai/data-table-react`

### Scope

The initial release (v0.1.0) covers:

- Three packages: `@data-brain/shared`, `@data-brain/api`, `@marlinjai/data-brain-sdk`
- All 43 DatabaseAdapter methods: tables, columns, rows, views, relations, select options, file references
- Bulk operations: bulk create, bulk delete, bulk archive (up to 1,000 rows)
- Tenant management via admin endpoint
- API key authentication with SHA-256 hashing
- Ownership verification on all resource access
