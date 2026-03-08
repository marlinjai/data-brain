---
title: Architecture
description: What Data Brain is, why it exists, and how it works
order: 4
icon: "🏗️"
summary: Data Brain is the multi-tenant backend for the Data Table component — it turns a local UI library into a cloud-hosted database service with API keys, workspace isolation, and quotas.
category: documentation
tags: [data-brain, architecture, system-design, multi-tenant]
projects: [data-brain]
status: active
---

# Architecture

## What Is Data Brain?

Data Brain is the **server-side backend for the Data Table component**. It takes the same `DatabaseAdapter` interface that Data Table uses locally (in-browser or on a single server) and exposes it as a **multi-tenant REST API** with authentication, workspace isolation, and quota management.

## The Problem It Solves

The [Data Table](/projects/data-table) project provides a Notion-like database UI as a React component library. It defines a `DatabaseAdapter` interface (CRUD for tables, columns, rows, views, select options, relations, and file references) and ships adapter implementations for different backends (D1, in-memory, etc.).

**Without Data Brain**, every app that uses Data Table must:

- Set up its own database and run its own adapter
- Implement its own auth and access control
- Handle multi-tenancy if serving multiple customers
- Manage quotas, rate limits, and usage tracking

**With Data Brain**, apps just install the SDK and call the API:

```typescript
import { DataBrain } from '@marlinjai/data-brain-sdk';

const db = new DataBrain({ apiKey: 'sk_live_...' });
const ws = db.withWorkspace('my-workspace');

const table = await ws.createTable({ name: 'Contacts' });
const rows = await ws.getRows(table.id, { limit: 50, filters: [...] });
```

Data Brain handles storage, auth, isolation, and quotas. The app only deals with business logic and UI.

## How Data Table and Data Brain Relate

```
┌─────────────────────────────────────────────────────┐
│  Data Table (React UI)                              │
│  - Renders tables, columns, rows, views             │
│  - Handles user interactions (edit, sort, filter)   │
│  - Talks to a DatabaseAdapter                       │
└──────────────────┬──────────────────────────────────┘
                   │ DatabaseAdapter interface
                   │
        ┌──────────┼──────────────┐
        │          │              │
   Local use    Self-hosted    Cloud use
   (D1Adapter   (Postgres      (DataBrainAdapter
    directly)    Adapter)       → HTTP → Data Brain API)
                                         │
                                    ┌────┴────┐
                                    │ D1      │ Postgres
                                    │ Adapter │ Adapter
                                    └─────────┘
```

- **Local use:** App imports an adapter directly, no network involved.
- **Self-hosted:** App runs its own Data Brain API instance with PostgreSQL.
- **Cloud use:** App uses the hosted Data Brain API via SDK. Data Brain adds tenancy, auth, workspaces, and quotas on top of the same adapter.

## System Overview

```
Client App
    │
    v
┌─────────────────────────┐
│  DataBrain SDK           │  @marlinjai/data-brain-sdk (npm)
│  - 47 typed methods      │
│  - Retry + backoff       │
│  - Typed error hierarchy │
│  - Workspace scoping     │
└─────────────────────────┘
    │ HTTP (JSON)
    v
┌─────────────────────────┐
│  Data Brain API          │  Cloudflare Worker / Node.js (Hono)
│  - API key auth          │
│  - Tenant isolation      │
│  - Workspace management  │
│  - Ownership checks      │
│  - Quota enforcement     │
│  - Zod validation        │
└─────────────────────────┘
    │                          │
    v                          v
┌──────────────┐   ┌───────────────────┐
│ D1 Adapter   │   │ Postgres Adapter  │
│ (cloud,      │   │ (self-hosted)     │
│  default)    │   │                   │
└──────────────┘   └───────────────────┘
```

## Core Concepts

### Tenants

A tenant is a customer with an API key. Each API request is authenticated by hashing the key with SHA-256 and looking it up in the tenants table. Tenants have:

- **Row quota** (`quotaRows`) -- max total rows across all tables
- **Table limit** (`maxTables`) -- max number of tables
- **Usage counters** (`usedRows`) -- tracked atomically on every insert/delete

### Workspaces

Workspaces are logical containers within a tenant. A tenant can have multiple workspaces to separate data (e.g., "Production" vs. "Staging", or per-team). Workspaces:

- Are selected via the `X-Workspace-Id` HTTP header (or `.withWorkspace()` in the SDK)
- Can have their own row quotas independent of the tenant-level quota
- Cascade on deletion -- deleting a workspace removes all its tables and data
- Are scoped to the tenant -- one tenant cannot access another's workspaces

### Data Model

Within each workspace, the data model matches the Data Table component exactly:

| Resource | Description |
|----------|-------------|
| **Tables** | Named containers for structured data, scoped to a workspace |
| **Columns** | Typed fields on a table (text, number, select, date, relation, file, etc.) |
| **Rows** | Records with JSON cell data keyed by column ID |
| **Views** | Saved filter/sort/group configurations for a table |
| **Select Options** | Predefined choices for select/multi-select columns |
| **Relations** | Row-to-row links across tables |
| **File References** | Metadata linking external files (from Storage Brain) to row cells |

## Three-Layer Architecture

### Layer 1: SDK (`@marlinjai/data-brain-sdk`)

The SDK provides two clients:

- **`DataBrain`** -- Main client with 46 methods (all DatabaseAdapter data operations + workspace CRUD + tenant info). Handles auth, serialization, retry with exponential backoff, and maps HTTP errors to typed exceptions (`AuthenticationError`, `NotFoundError`, `ValidationError`, `QuotaExceededError`, etc.).
- **`DataBrainAdmin`** -- Admin client for tenant provisioning, exported separately from `@marlinjai/data-brain-sdk/admin`.

### Layer 2: API (`@data-brain/api`)

A Hono web app that runs on Cloudflare Workers (production) or Node.js (self-hosted). The request pipeline:

1. **Security headers** + request ID + CORS
2. **Auth middleware** -- extract Bearer token, hash it, look up tenant
3. **Workspace resolution** -- read `X-Workspace-Id` header, verify it belongs to the tenant
4. **Zod validation** -- validate request body against schemas from `@data-brain/shared`
5. **Ownership checks** -- verify the requested table/column/row belongs to the tenant's workspace
6. **Quota checks** -- before creating rows or tables, verify limits aren't exceeded
7. **Adapter call** -- delegate to D1 or Postgres adapter
8. **Response** -- JSON with appropriate status code

The API uses two categories of adapters:
- **Tenant adapters** (`D1TenantAdapter`, `PostgresTenantAdapter`) -- manage tenants and workspaces
- **Data adapters** (`D1Adapter` from `@marlinjai/data-table-adapter-d1`, `PostgresDataAdapter` local) -- handle tables, columns, rows, views via the `DatabaseAdapter` interface

### Layer 3: Storage

- **Cloudflare D1** (default) -- SQLite at the edge, zero config. Uses `@marlinjai/data-table-adapter-d1` (the same adapter the Data Table component uses directly).
- **PostgreSQL** (self-hosted) -- same interface, different backend. Uses a local `PostgresDataAdapter`.

Both implement the full `DatabaseAdapter` interface, so the API layer is backend-agnostic.

## Package Structure

```
data-brain/
├── packages/
│   ├── shared/                 @data-brain/shared (internal)
│   │   ├── types.ts            Tenant, Workspace, TenantInfo, TenantContext
│   │   ├── schemas.ts          Zod schemas for all endpoints
│   │   └── constants.ts        Quotas, limits, API key prefixes
│   │
│   ├── api/                    @data-brain/api (Cloudflare Worker / Node.js)
│   │   ├── app.ts              Hono app setup, route registration
│   │   ├── node.ts             Node.js entry point (self-hosted)
│   │   ├── adapters/
│   │   │   ├── tenant/         D1TenantAdapter, PostgresTenantAdapter
│   │   │   └── data/           PostgresDataAdapter (D1 uses @marlinjai/data-table-adapter-d1)
│   │   ├── middleware/
│   │   │   ├── auth.ts         API key hashing + tenant lookup
│   │   │   ├── quota.ts        Row/table quota enforcement
│   │   │   └── error-handler.ts
│   │   ├── routes/             One file per resource (tables, columns, rows, ...)
│   │   └── migrations/         SQL schema files
│   │
│   └── sdk/                    @marlinjai/data-brain-sdk (npm, v0.2.0)
│       ├── client.ts           DataBrain class (46 methods)
│       ├── admin.ts            DataBrainAdmin class (tenant provisioning)
│       ├── errors.ts           Typed error hierarchy
│       └── types.ts            Config types, workspace types
```

## Database Schema

### Tenant & Workspace Management

| Table | Purpose |
|-------|---------|
| `tenants` | Tenant records with hashed API keys, quotas, and usage counters |
| `workspaces` | Workspace records scoped to tenants, with optional per-workspace quotas |

### Data Tables (managed by DatabaseAdapter)

| Table | Purpose |
|-------|---------|
| `dt_tables` | Table definitions, scoped by `workspace_id` |
| `dt_columns` | Column definitions with type, position, config |
| `dt_rows` | Row records with JSON cell data |
| `dt_views` | Saved view configurations |
| `dt_select_options` | Options for select/multi_select columns |
| `dt_relations` | Row-to-row relation links |
| `dt_files` | File reference records linking external files to rows |

## API Endpoints (53 routes)

### Admin (requires `ADMIN_API_KEY`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/admin/tenants` | Create tenant, returns raw API key |
| GET | `/api/v1/admin/tenants` | List tenants (cursor pagination) |
| GET | `/api/v1/admin/tenants/:id` | Tenant detail + quota usage |
| PATCH | `/api/v1/admin/tenants/:id` | Update tenant |
| DELETE | `/api/v1/admin/tenants/:id` | Delete tenant + cascade |
| POST | `/api/v1/admin/tenants/:id/regenerate-key` | Regenerate tenant API key |

### Tenant & Workspaces (requires API key)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tenant/info` | Current tenant quotas and usage |
| GET/POST | `/api/v1/workspaces` | List / create workspaces |
| GET/PATCH/DELETE | `/api/v1/workspaces/:id` | Read / update / delete workspace |

### Data Operations (requires API key + workspace)

| Resource | Endpoints |
|----------|-----------|
| **Tables** | CRUD on `/api/v1/tables` |
| **Columns** | CRUD on `/api/v1/tables/:id/columns`, reorder |
| **Rows** | CRUD + bulk create/delete/archive, filtering, sorting, pagination |
| **Views** | CRUD on `/api/v1/tables/:id/views`, reorder |
| **Select Options** | CRUD on `/api/v1/columns/:id/options`, reorder |
| **Relations** | Create/delete/query on `/api/v1/relations` (no reorder) |
| **File References** | Add/remove/list/reorder on `/api/v1/file-refs` |

## Security Model

- **API key hashing** -- Keys hashed with SHA-256 via Web Crypto API before storage
- **Admin key** -- Compared using `crypto.subtle.timingSafeEqual` to prevent timing attacks
- **Ownership verification** -- Every resource access verifies it belongs to the authenticated tenant's workspace
- **Zod validation** -- All request bodies validated against strict schemas
- **Bulk safety** -- Bulk operations verify ownership of every row before proceeding
- **Quota enforcement** -- Row and table limits checked atomically before writes

## Deployment Options

### Cloudflare Workers (Production)

Deploys as a single Worker with a D1 database binding. Production URL: `https://data-brain-api.marlin-pohl.workers.dev`

### Self-Hosted (Docker)

Same API running on Node.js with PostgreSQL:

```
docker-compose.yml
├── api        (Node.js + Hono, port 3001)
└── postgres   (PostgreSQL 16)
```

