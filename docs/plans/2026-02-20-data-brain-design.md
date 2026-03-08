---
title: Data Brain — Design Document
summary: Design document for Data Brain, a reusable structured data API service that exposes the full DatabaseAdapter interface over HTTP via a Cloudflare Worker, with TypeScript SDK and drop-in data-table adapter.
category: plan
tags: [data-brain, design, api, cloudflare-workers, database-adapter]
projects: [data-brain]
status: active
date: 2026-02-20
---

# Data Brain — Design Document

**Date:** 2026-02-20
**Status:** Approved
**Scope:** Reusable structured data API service for the ERP suite

---

## Problem Statement

The data-table package has a `DatabaseAdapter` interface with 43 methods (tables, columns, rows, views, select options, relations, file references). Concrete adapters exist for D1 and in-memory, but they can only run server-side. Frontend apps (React) need to access these operations over HTTP. Currently there is no network layer between client-side data-table hooks and server-side database adapters.

## Solution

Data Brain is a reusable structured data API service — the database equivalent of Storage Brain (which handles file storage). It exposes the full `DatabaseAdapter` interface over HTTP via a Cloudflare Worker, with a TypeScript SDK and a drop-in adapter for the data-table package.

```
Storage Brain = file storage as a service (R2)
Data Brain    = structured data as a service (D1/Postgres)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Any App (Receipt OCR, Framer Clone, Email Builder, etc.)       │
│                                                                  │
│  <DataTableProvider dbAdapter={dataBrainAdapter}>                │
│    React hooks: useTable(), addRow(), updateCell()               │
│  </DataTableProvider>                                            │
│       │                                                          │
│       ▼                                                          │
│  DataBrainAdapter (implements DatabaseAdapter)                   │
│  @marlinjai/data-table-adapter-data-brain                        │
│       │                                                          │
│       ▼ uses                                                     │
│  DataBrain SDK (@marlinjai/data-brain-sdk)                       │
│       │                                                          │
└───────│──────────────────────────────────────────────────────────┘
        │ HTTP (fetch)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Data Brain API (Cloudflare Worker)                              │
│  @data-brain/api                                                 │
│                                                                  │
│  Middleware: auth → tenant isolation → rate limiting              │
│  Routes: /api/v1/tables, /rows, /columns, /views, etc.          │
│       │                                                          │
│       ▼ delegates to                                             │
│  D1Adapter (from @marlinjai/data-table-adapter-d1)               │
│       │                                                          │
│       ▼                                                          │
│  Cloudflare D1 (SQL database)                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Package Structure

### New monorepo: `projects/lumitra-infra/data-brain/`

```
projects/lumitra-infra/data-brain/
├── packages/
│   ├── api/           # @data-brain/api (private) — Hono on Cloudflare Workers
│   │   ├── src/
│   │   │   ├── index.ts           # Worker entry, Hono app
│   │   │   ├── env.ts             # Env type (D1 binding)
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts        # API key → tenant resolution
│   │   │   │   └── error-handler.ts
│   │   │   ├── routes/
│   │   │   │   ├── tables.ts      # /api/v1/tables
│   │   │   │   ├── columns.ts     # /api/v1/tables/:id/columns
│   │   │   │   ├── rows.ts        # /api/v1/tables/:id/rows
│   │   │   │   ├── views.ts       # /api/v1/tables/:id/views
│   │   │   │   ├── select-options.ts
│   │   │   │   ├── relations.ts
│   │   │   │   ├── file-refs.ts
│   │   │   │   ├── batch.ts       # /api/v1/rpc/batch
│   │   │   │   ├── tenant.ts      # /api/v1/tenant
│   │   │   │   └── admin.ts       # /api/v1/admin
│   │   │   └── services/
│   │   │       ├── tenant.ts      # API key generation, hashing
│   │   │       └── quota.ts       # Row/table quota management
│   │   ├── migrations/
│   │   │   └── 0001_tenants.sql   # Tenant table schema
│   │   └── wrangler.toml
│   │
│   ├── sdk/           # @marlinjai/data-brain-sdk (public npm)
│   │   └── src/
│   │       ├── index.ts
│   │       ├── client.ts          # DataBrain class
│   │       ├── types.ts           # All public types
│   │       ├── errors.ts          # Error class hierarchy
│   │       └── constants.ts
│   │
│   └── shared/        # @data-brain/shared (private)
│       └── src/
│           ├── index.ts
│           ├── types.ts           # Tenant, API types
│           ├── schemas.ts         # Zod validation schemas
│           └── constants.ts
│
├── docs/
├── pnpm-workspace.yaml
└── package.json
```

### New package in data-table monorepo:

```
projects/data-table/
└── packages/
    └── adapter-data-brain/    # @marlinjai/data-table-adapter-data-brain
        └── src/
            └── index.ts       # DataBrainAdapter extends BaseDatabaseAdapter
```

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Adapter interface | Reuse `DatabaseAdapter` from data-table-core | Single source of truth for the 43-method contract |
| SDK style | Simple CRUD methods matching adapter signatures | Must be compatible with data-table hooks without a shim layer |
| Adapter location | `adapter-data-brain` in data-table monorepo | Same pattern as adapter-d1, adapter-memory |
| Tenant isolation | API middleware only, not in DatabaseAdapter | Don't pollute the adapter interface with infrastructure concerns |
| Route design | REST per resource + `POST /rpc/batch` | Clean REST for external use, batch for round-trip efficiency |
| Multi-tenancy | Shared D1 + tenant_id column | Same pattern as Storage Brain, simplest to start |
| Auth | API key (sk_live_/sk_test_), SHA-256 hashed | Same as Storage Brain |
| Framework | Hono 4.x | Same as Storage Brain, minimal footprint for Workers |
| Build | tsup (dual CJS + ESM) | Same as Storage Brain SDK |
| Internal DB adapter | Import D1Adapter from @marlinjai/data-table-adapter-d1 | Reuse existing tested adapter, don't rewrite SQL |

## API Routes

### Tables
```
GET    /api/v1/workspaces/:workspaceId/tables   → listTables
POST   /api/v1/tables                            → createTable
GET    /api/v1/tables/:tableId                   → getTable
PATCH  /api/v1/tables/:tableId                   → updateTable
DELETE /api/v1/tables/:tableId                   → deleteTable
```

### Columns
```
GET    /api/v1/tables/:tableId/columns           → getColumns
POST   /api/v1/tables/:tableId/columns           → createColumn
GET    /api/v1/columns/:columnId                 → getColumn
PATCH  /api/v1/columns/:columnId                 → updateColumn
DELETE /api/v1/columns/:columnId                 → deleteColumn
PUT    /api/v1/tables/:tableId/columns/reorder   → reorderColumns
```

### Rows
```
GET    /api/v1/tables/:tableId/rows              → getRows (with query params)
POST   /api/v1/tables/:tableId/rows              → createRow
GET    /api/v1/rows/:rowId                       → getRow
PATCH  /api/v1/rows/:rowId                       → updateRow
DELETE /api/v1/rows/:rowId                       → deleteRow
POST   /api/v1/rows/:rowId/archive               → archiveRow
POST   /api/v1/rows/:rowId/unarchive             → unarchiveRow
POST   /api/v1/tables/:tableId/rows/bulk         → bulkCreateRows
DELETE /api/v1/rows/bulk                          → bulkDeleteRows
POST   /api/v1/rows/bulk/archive                 → bulkArchiveRows
```

### Views
```
GET    /api/v1/tables/:tableId/views             → getViews
POST   /api/v1/tables/:tableId/views             → createView
GET    /api/v1/views/:viewId                     → getView
PATCH  /api/v1/views/:viewId                     → updateView
DELETE /api/v1/views/:viewId                     → deleteView
PUT    /api/v1/tables/:tableId/views/reorder     → reorderViews
```

### Select Options
```
GET    /api/v1/columns/:columnId/options         → getSelectOptions
POST   /api/v1/columns/:columnId/options         → createSelectOption
PATCH  /api/v1/options/:optionId                 → updateSelectOption
DELETE /api/v1/options/:optionId                 → deleteSelectOption
PUT    /api/v1/columns/:columnId/options/reorder → reorderSelectOptions
```

### Relations
```
POST   /api/v1/relations                         → createRelation
DELETE /api/v1/relations                          → deleteRelation (body: source, column, target)
GET    /api/v1/rows/:rowId/relations/:columnId   → getRelatedRows
GET    /api/v1/rows/:rowId/relations             → getRelationsForRow
```

### File References
```
POST   /api/v1/file-refs                         → addFileReference
DELETE /api/v1/file-refs/:fileRefId              → removeFileReference
GET    /api/v1/rows/:rowId/files/:columnId       → getFileReferences
PUT    /api/v1/rows/:rowId/files/:columnId/reorder → reorderFileReferences
```

### Batch / RPC
```
POST   /api/v1/rpc/batch                         → execute multiple operations atomically
```

### Tenant / Admin
```
GET    /api/v1/tenant/info                       → getTenantInfo
POST   /api/v1/admin/tenants                     → createTenant (admin only)
```

## SDK Public API

```typescript
import { DataBrain } from '@marlinjai/data-brain-sdk';

const client = new DataBrain({
  apiKey: 'sk_live_...',
  baseUrl: 'https://data-brain-api.marlin-pohl.workers.dev', // default
  timeout: 30000,
  maxRetries: 3,
});

// Tables
client.createTable(input: CreateTableInput): Promise<Table>
client.getTable(tableId: string): Promise<Table | null>
client.updateTable(tableId: string, updates: UpdateTableInput): Promise<Table>
client.deleteTable(tableId: string): Promise<void>
client.listTables(workspaceId: string): Promise<Table[]>

// Columns
client.createColumn(input: CreateColumnInput): Promise<Column>
client.getColumns(tableId: string): Promise<Column[]>
client.getColumn(columnId: string): Promise<Column | null>
client.updateColumn(columnId: string, updates: UpdateColumnInput): Promise<Column>
client.deleteColumn(columnId: string): Promise<void>
client.reorderColumns(tableId: string, columnIds: string[]): Promise<void>

// Rows
client.createRow(input: CreateRowInput): Promise<Row>
client.getRow(rowId: string): Promise<Row | null>
client.getRows(tableId: string, query?: QueryOptions): Promise<QueryResult<Row>>
client.updateRow(rowId: string, cells: Record<string, CellValue>): Promise<Row>
client.deleteRow(rowId: string): Promise<void>
client.archiveRow(rowId: string): Promise<void>
client.unarchiveRow(rowId: string): Promise<void>
client.bulkCreateRows(inputs: CreateRowInput[]): Promise<Row[]>
client.bulkDeleteRows(rowIds: string[]): Promise<void>
client.bulkArchiveRows(rowIds: string[]): Promise<void>

// Views
client.createView(input: CreateViewInput): Promise<View>
client.getViews(tableId: string): Promise<View[]>
client.getView(viewId: string): Promise<View | null>
client.updateView(viewId: string, updates: UpdateViewInput): Promise<View>
client.deleteView(viewId: string): Promise<void>
client.reorderViews(tableId: string, viewIds: string[]): Promise<void>

// Select Options
client.createSelectOption(input: CreateSelectOptionInput): Promise<SelectOption>
client.getSelectOptions(columnId: string): Promise<SelectOption[]>
client.updateSelectOption(optionId: string, updates: UpdateSelectOptionInput): Promise<SelectOption>
client.deleteSelectOption(optionId: string): Promise<void>
client.reorderSelectOptions(columnId: string, optionIds: string[]): Promise<void>

// Relations
client.createRelation(input: CreateRelationInput): Promise<void>
client.deleteRelation(sourceRowId: string, columnId: string, targetRowId: string): Promise<void>
client.getRelatedRows(rowId: string, columnId: string): Promise<Row[]>
client.getRelationsForRow(rowId: string): Promise<Array<{ columnId: string; targetRowId: string }>>

// File References
client.addFileReference(input: CreateFileRefInput): Promise<FileReference>
client.removeFileReference(fileRefId: string): Promise<void>
client.getFileReferences(rowId: string, columnId: string): Promise<FileReference[]>
client.reorderFileReferences(rowId: string, columnId: string, fileRefIds: string[]): Promise<void>

// Batch
client.batch(operations: BatchOperation[]): Promise<BatchResult[]>

// Tenant
client.getTenantInfo(): Promise<TenantInfo>
```

All types re-exported from `@marlinjai/data-table-core` — no duplication.

## Data Table Adapter Usage

```typescript
import { DataBrain } from '@marlinjai/data-brain-sdk';
import { DataBrainAdapter } from '@marlinjai/data-table-adapter-data-brain';

const client = new DataBrain({ apiKey: process.env.DATA_BRAIN_API_KEY });
const adapter = new DataBrainAdapter({ client, workspaceId: 'receipt-ocr' });

// Drop-in replacement — zero component changes
<DataTableProvider dbAdapter={adapter} workspaceId="receipt-ocr">
  <Dashboard />
</DataTableProvider>
```

## Database Schema (Data Brain's own tables)

Data Brain needs its own `tenants` table. The data-table schema (dt_tables, dt_columns, dt_rows, etc.) is managed by the D1Adapter's migration — reused as-is.

```sql
-- Data Brain tenant management (separate from data-table schema)
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  quota_rows INTEGER DEFAULT 100000,
  used_rows INTEGER DEFAULT 0,
  max_tables INTEGER DEFAULT 100,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_tenants_api_key_hash ON tenants(api_key_hash);
```

The D1Adapter's migration (`0001_initial.sql` from data-table) is applied to the same D1 database. Tenant isolation is enforced by the API middleware mapping `tenant_id` to `workspaceId` — each tenant gets their own workspace scope.

## Tenant Isolation Strategy

1. API key resolved in auth middleware → tenant object attached to context
2. `tenant.id` mapped to `workspaceId` for all adapter calls
3. `listTables(workspaceId)` naturally scopes to the tenant
4. Row/column/view operations go through table → table belongs to workspace → workspace belongs to tenant
5. No cross-tenant access possible because table IDs are UUIDs and workspace scoping is enforced at every entry point

## Error Handling

SDK error classes mirror Storage Brain pattern:

```typescript
DataBrainError (base)
├── AuthenticationError    (401)
├── NotFoundError          (404)
├── ValidationError        (400)
├── QuotaExceededError     (403)
├── ConflictError          (409)
├── NetworkError           (connection issues)
└── BatchError             (partial failure in batch)
```

## Out of Scope (V1)

- Real-time subscriptions (WebSocket/SSE)
- Postgres adapter (D1 only for V1)
- Row-level permissions / RBAC
- Webhooks on data changes
- Full-text search
- Computed columns / formulas execution on server
