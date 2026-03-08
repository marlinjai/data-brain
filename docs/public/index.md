---
title: Data Brain
description: Structured data as a service
order: 0
icon: "🗄️"
summary: Landing page for Data Brain documentation, the structured data as a service platform wrapping the full DatabaseAdapter interface (40 methods) in an HTTP API backed by Cloudflare D1.
category: documentation
tags: [data-brain, index, structured-data, cloudflare-d1]
projects: [data-brain]
status: active
---

# Data Brain

Structured data as a service -- the database equivalent of Storage Brain. Data Brain wraps the full `DatabaseAdapter` interface (40 methods) in an HTTP API backed by Cloudflare D1, with a TypeScript SDK for client-side use.

## Features

- **Full DatabaseAdapter Coverage** -- 40 methods exposed over HTTP (tables, columns, rows, views, relations, select options, file references)
- **Multi-Tenant** -- API key isolation with per-tenant quota and workspace scoping
- **Cloudflare D1 Backend** -- Edge-first, SQLite-based storage with minimal latency
- **TypeScript SDK** -- Full type safety with automatic retry and typed errors
- **Drop-In Adapter** -- Use as a `DatabaseAdapter` for `@marlinjai/data-table-react`

## Architecture

Data Brain uses a three-layer design:

1. **SDK** -- TypeScript client with retry logic, typed errors, and full method coverage
2. **API** -- Hono-based Cloudflare Worker with auth, ownership verification, and Zod validation
3. **Storage** -- Cloudflare D1 via `@marlinjai/data-table-adapter-d1`

## Quick Links

- [Quick Start](/quickstart) -- Get started with Data Brain
- [SDK Guide](/sdk) -- TypeScript SDK usage and reference
- [API Reference](/api-reference) -- Full endpoint documentation
- [Architecture](/architecture) -- System design and data flow
