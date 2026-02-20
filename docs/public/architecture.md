---
title: Architecture
description: System design and data flow
order: 4
icon: layers
---

# Architecture

Data Brain is a structured data service that exposes the full `DatabaseAdapter` interface over HTTP. This page covers the system design, tenant isolation model, and deployment architecture.

## System Overview

```
Client App
    |
    v
+-------------------------+
|  DataBrain SDK          |   TypeScript (npm package)
|  - Typed methods        |
|  - Retry + backoff      |
|  - Error hierarchy      |
+-------------------------+
    | HTTP (JSON)
    v
+-------------------------+
|  Data Brain API         |   Cloudflare Worker (Hono)
|  - Auth middleware       |
|  - Ownership checks     |
|  - Zod validation       |
|  - Tenant isolation     |
+-------------------------+
    |
    v
+-------------------------+
|  D1Adapter              |   @marlinjai/data-table-adapter-d1
|  - 43 adapter methods   |
|  - SQL generation       |
+-------------------------+
    |
    v
+-------------------------+
|  Cloudflare D1          |   SQLite at the edge
+-------------------------+
```

## Three-Layer Architecture

### Layer 1: SDK

The `@marlinjai/data-brain-sdk` package provides a typed TypeScript client that mirrors the full `DatabaseAdapter` interface. It handles authentication, serialization, retry logic with exponential backoff, and maps HTTP errors to a typed error hierarchy.

### Layer 2: API

The Cloudflare Worker (Hono) serves as the authentication and authorization gateway. It:

- Validates API keys by hashing with SHA-256 and looking up the hash in D1
- Verifies resource ownership on every request (tables, columns, rows all scoped to tenant)
- Validates request bodies with Zod schemas from `@data-brain/shared`
- Delegates to the D1Adapter for all database operations

### Layer 3: Storage

Cloudflare D1 provides SQLite-based storage at the edge. The `@marlinjai/data-table-adapter-d1` package implements all 43 `DatabaseAdapter` methods, so Data Brain reuses the same adapter used by the Data Table component.

## Tenant Isolation Model

Every request goes through the following isolation flow:

```
Request with Bearer token
    |
    v
Extract API key from Authorization header
    |
    v
SHA-256 hash the key (Web Crypto API)
    |
    v
Look up hash in tenants table
    |
    v
Attach tenant context to request
    |
    v
Use tenant.id as workspaceId for all operations
    |
    v
Verify resource ownership before every read/write
```

Key properties:
- **Stateless** -- No session management; each request is independently authenticated
- **Workspace-scoped** -- The tenant ID becomes the `workspaceId` parameter for all adapter calls
- **Ownership-verified** -- Before accessing a table, column, row, or view, the API confirms it belongs to the authenticated tenant's workspace

## Data Flow Examples

### Create Table

```
SDK: db.createTable({ name: "Contacts" })
  |
  POST /api/v1/tables { name: "Contacts" }
  |
  API: authMiddleware -> validate body -> getWorkspaceId(tenant.id)
  |
  D1Adapter: INSERT INTO dt_tables (id, workspace_id, name, ...)
  |
  Response: 201 { id: "tbl_...", name: "Contacts", ... }
```

### Query Rows

```
SDK: db.getRows(tableId, { limit: 50, filters: [...] })
  |
  GET /api/v1/tables/:tableId/rows?limit=50&filters=[...]
  |
  API: authMiddleware -> verifyTableOwnership -> parse query
  |
  D1Adapter: SELECT * FROM dt_rows WHERE table_id = ? ...
  |
  Response: 200 { rows: [...], total: 42 }
```

## Package Structure

```
data-brain/
├── packages/
│   ├── shared/              @data-brain/shared (internal)
│   │   ├── types.ts         Tenant, TenantInfo, BatchOperation types
│   │   ├── schemas.ts       Zod validation schemas for all endpoints
│   │   └── constants.ts     API key prefixes, quotas, rate limits
│   │
│   ├── api/                 @data-brain/api (Cloudflare Worker)
│   │   ├── index.ts         Hono app with all route groups
│   │   ├── adapter.ts       D1Adapter factory, workspaceId helper
│   │   ├── env.ts           Environment type definitions
│   │   ├── middleware/
│   │   │   ├── auth.ts      API key hashing + tenant lookup
│   │   │   ├── ownership.ts Table/column/row ownership verification
│   │   │   └── error-handler.ts  Structured error responses
│   │   ├── routes/          One file per resource group
│   │   └── services/
│   │       └── tenant.ts    Tenant provisioning + API key generation
│   │
│   └── sdk/                 @marlinjai/data-brain-sdk (npm)
│       ├── client.ts        DataBrain class with 43 methods
│       ├── types.ts         DataBrainConfig, TenantInfo, etc.
│       ├── errors.ts        Typed error hierarchy
│       └── constants.ts     Retry configuration
```

## D1 Schema

Data Brain uses two categories of tables in D1:

### Tenant Management

| Table | Purpose |
|-------|---------|
| `tenants` | Tenant records with hashed API keys, quotas, and usage counters |

### Data Tables (managed by D1Adapter)

| Table | Purpose |
|-------|---------|
| `dt_tables` | Table definitions, scoped by `workspace_id` |
| `dt_columns` | Column definitions with type, position, config |
| `dt_rows` | Row records with JSON cell data |
| `dt_views` | Saved view configurations |
| `dt_select_options` | Options for select/multi_select columns |
| `dt_relations` | Row-to-row relation links |
| `dt_files` | File reference records linking external files to rows |

## Security Model

- **API key hashing** -- Keys are hashed with SHA-256 via the Web Crypto API before storage. SHA-256 is used instead of bcrypt because tenant lookup requires synchronous hash comparison, and SHA-256 is fast enough for per-request auth
- **Admin key comparison** -- The admin API key is compared using `crypto.subtle.timingSafeEqual` to prevent timing attacks
- **Ownership verification** -- Every resource access verifies the resource belongs to the authenticated tenant's workspace
- **Zod validation** -- All request bodies are validated against strict schemas before processing
- **Bulk safety** -- Bulk operations verify ownership of every row before proceeding

## Deployment

Data Brain deploys as a single Cloudflare Worker with a D1 binding:

```
Cloudflare Worker
+-- Hono App
|   +-- GET  /health
|   +-- GET  /api/v1/tables (+ POST, GET/:id, PATCH/:id, DELETE/:id)
|   +-- GET  /api/v1/tables/:id/columns (+ POST, reorder)
|   +-- GET  /api/v1/columns/:id (+ PATCH, DELETE)
|   +-- GET  /api/v1/tables/:id/rows (+ POST, bulk)
|   +-- GET  /api/v1/rows/:id (+ PATCH, DELETE, archive, unarchive)
|   +-- GET  /api/v1/tables/:id/views (+ POST, reorder)
|   +-- GET  /api/v1/views/:id (+ PATCH, DELETE)
|   +-- GET  /api/v1/columns/:id/options (+ POST, reorder)
|   +-- PATCH /api/v1/options/:id (+ DELETE)
|   +-- POST /api/v1/relations (+ DELETE, GET)
|   +-- POST /api/v1/file-refs (+ DELETE, GET, reorder)
|   +-- GET  /api/v1/tenant/info
|   +-- POST /api/v1/admin/tenants
+-- Bindings
    +-- DB: Cloudflare D1 (data-brain-db)
    +-- ADMIN_API_KEY: Secret
    +-- ENVIRONMENT: Variable
```
