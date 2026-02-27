# Data Brain

Structured data as a service -- the database equivalent of [Storage Brain](https://github.com/marlinjai/storage-brain).

Data Brain wraps the full [`DatabaseAdapter`](https://github.com/marlinjai/marlinjai-data-table) interface (43 methods) as REST endpoints, backed by Cloudflare D1. A TypeScript SDK (`@marlinjai/data-brain-sdk`) provides a typed client for all operations.

**Production URL:** `https://data-brain-api.marlin-pohl.workers.dev`

## Architecture

```
Client App
  +-- DataBrainAdapter (data-table)
      +-- DataBrain SDK (HTTP)
          +-- Data Brain API (Cloudflare Worker + Hono)
              +-- D1Adapter (data-table-adapter-d1)
                  +-- Cloudflare D1
```

- **Multi-tenant:** Each API key maps to a tenant; all data is scoped by tenant + workspace.
- **43 DatabaseAdapter methods:** Tables, columns, rows, views, relations, select options, file references.
- **Edge-first:** Runs on Cloudflare Workers with D1 for minimal latency.
- **Workspace isolation:** Data is partitioned into workspaces within each tenant. Pass `X-Workspace-Id` header or configure the SDK with `workspaceId`.

## Packages

| Package | Description | Published |
|---------|-------------|-----------|
| `@data-brain/api` | Cloudflare Workers API (Hono) | Private |
| `@data-brain/shared` | Types, Zod schemas, constants | Private |
| `@marlinjai/data-brain-sdk` | TypeScript SDK (v0.2.0) | [npm](https://www.npmjs.com/package/@marlinjai/data-brain-sdk) |

---

## API Endpoints

All data endpoints require `Authorization: Bearer <api_key>` header. Workspace-scoped endpoints use the `X-Workspace-Id` header.

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (returns status, timestamp, environment) |

### Admin (requires `ADMIN_API_KEY`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/admin/tenants` | Create a new tenant (returns tenant info + raw API key) |

### Tenant

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tenant/info` | Get current tenant info (quotas, usage) |

### Workspaces

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/workspaces` | List all workspaces for the tenant |
| POST | `/api/v1/workspaces` | Create a workspace |
| GET | `/api/v1/workspaces/:workspaceId` | Get a workspace by ID |
| PATCH | `/api/v1/workspaces/:workspaceId` | Update a workspace (name, quotaRows, metadata) |
| DELETE | `/api/v1/workspaces/:workspaceId` | Delete a workspace and all its data |

### Tables

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tables` | List tables (filtered by workspace via `X-Workspace-Id`) |
| POST | `/api/v1/tables` | Create a table |
| GET | `/api/v1/tables/:tableId` | Get a table by ID |
| PATCH | `/api/v1/tables/:tableId` | Update a table (name, description, icon) |
| DELETE | `/api/v1/tables/:tableId` | Delete a table and all its data |

### Columns

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tables/:tableId/columns` | List columns for a table |
| POST | `/api/v1/tables/:tableId/columns` | Create a column |
| GET | `/api/v1/columns/:columnId` | Get a column by ID |
| PATCH | `/api/v1/columns/:columnId` | Update a column |
| DELETE | `/api/v1/columns/:columnId` | Delete a column |
| PUT | `/api/v1/tables/:tableId/columns/reorder` | Reorder columns (body: string[]) |

### Rows

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tables/:tableId/rows` | Query rows (supports limit, offset, cursor, filters, sorts) |
| POST | `/api/v1/tables/:tableId/rows` | Create a row |
| GET | `/api/v1/rows/:rowId` | Get a row by ID |
| PATCH | `/api/v1/rows/:rowId` | Update row cells |
| DELETE | `/api/v1/rows/:rowId` | Delete a row |
| POST | `/api/v1/rows/:rowId/archive` | Archive a row |
| POST | `/api/v1/rows/:rowId/unarchive` | Unarchive a row |
| POST | `/api/v1/tables/:tableId/rows/bulk` | Bulk create rows (max 1000) |
| DELETE | `/api/v1/rows/bulk` | Bulk delete rows (body: string[]) |
| POST | `/api/v1/rows/bulk/archive` | Bulk archive rows (body: string[]) |

**Row query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max rows to return (default 50, max 200) |
| `offset` | number | Offset for pagination |
| `cursor` | string | Cursor-based pagination |
| `filters` | JSON | Array of filter objects |
| `sorts` | JSON | Array of sort objects |
| `includeArchived` | boolean | Include archived rows |
| `parentRowId` | string | Filter by parent row |
| `includeSubItems` | boolean | Include sub-items |

### Views

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tables/:tableId/views` | List views for a table |
| POST | `/api/v1/tables/:tableId/views` | Create a view |
| GET | `/api/v1/views/:viewId` | Get a view by ID |
| PATCH | `/api/v1/views/:viewId` | Update a view |
| DELETE | `/api/v1/views/:viewId` | Delete a view |
| PUT | `/api/v1/tables/:tableId/views/reorder` | Reorder views (body: string[]) |

### Select Options

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/columns/:columnId/options` | List select options for a column |
| POST | `/api/v1/columns/:columnId/options` | Create a select option |
| PATCH | `/api/v1/options/:optionId` | Update a select option |
| DELETE | `/api/v1/options/:optionId` | Delete a select option |
| PUT | `/api/v1/columns/:columnId/options/reorder` | Reorder select options (body: string[]) |

### Relations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/relations` | Create a relation |
| DELETE | `/api/v1/relations` | Delete a relation (body: {sourceRowId, columnId, targetRowId}) |
| GET | `/api/v1/rows/:rowId/relations/:columnId` | Get related rows for a column |
| GET | `/api/v1/rows/:rowId/relations` | Get all relations for a row |

### File References

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/file-refs` | Add a file reference |
| DELETE | `/api/v1/file-refs/:fileRefId` | Remove a file reference |
| GET | `/api/v1/rows/:rowId/files/:columnId` | Get file references for a row+column |
| PUT | `/api/v1/rows/:rowId/files/:columnId/reorder` | Reorder file references (body: string[]) |

### Batch (currently disabled)

The batch endpoint `POST /api/v1/rpc/batch` is disabled pending per-operation tenant ownership checks. It supports all 43 adapter methods in a single request.

---

## Authentication

Data Brain uses Bearer token authentication with API keys.

- **Tenant API keys:** Prefixed with `sk_live_` (production) or `sk_test_` (test).
- **Admin API key:** Set via `wrangler secret put ADMIN_API_KEY`. Used only for the `POST /api/v1/admin/tenants` endpoint.

All requests must include:
```
Authorization: Bearer sk_live_...
```

---

## SDK Usage

### Installation

```bash
npm install @marlinjai/data-brain-sdk
```

### Create a Client

```typescript
import { DataBrain } from '@marlinjai/data-brain-sdk';

const db = new DataBrain({
  apiKey: 'sk_live_...',
  // baseUrl defaults to https://data-brain-api.marlin-pohl.workers.dev
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | (required) | Tenant API key |
| `baseUrl` | string | `https://data-brain-api.marlin-pohl.workers.dev` | API base URL |
| `timeout` | number | 30000 | Request timeout in ms |
| `maxRetries` | number | 3 | Max retry attempts for 5xx/network errors |
| `workspaceId` | string | - | Default workspace ID (sent as `X-Workspace-Id`) |

### Workspace Management

```typescript
// Create a workspace
const workspace = await db.createWorkspace({
  name: 'My Project',
  slug: 'my-project',
  quotaRows: 50000,
  metadata: { plan: 'pro' },
});

// List workspaces
const workspaces = await db.listWorkspaces();

// Scope all subsequent calls to a workspace
const ws = db.withWorkspace(workspace.id);
```

### Table CRUD

```typescript
const ws = db.withWorkspace('workspace-id');

// Create a table
const table = await ws.createTable({ name: 'Contacts' });

// List tables
const tables = await ws.listTables('workspace-id');

// Update a table
await ws.updateTable(table.id, { name: 'People', description: 'Contact list' });

// Delete a table
await ws.deleteTable(table.id);
```

### Column CRUD

```typescript
// Add columns
const nameCol = await ws.createColumn({
  tableId: table.id,
  name: 'Name',
  type: 'text',
  isPrimary: true,
});

const emailCol = await ws.createColumn({
  tableId: table.id,
  name: 'Email',
  type: 'email',
});

// List columns
const columns = await ws.getColumns(table.id);

// Reorder columns
await ws.reorderColumns(table.id, [emailCol.id, nameCol.id]);
```

### Row CRUD

```typescript
// Create a row
const row = await ws.createRow({
  tableId: table.id,
  cells: {
    [nameCol.id]: { value: 'Alice' },
    [emailCol.id]: { value: 'alice@example.com' },
  },
});

// Query rows with filters and pagination
const { rows, total } = await ws.getRows(table.id, {
  limit: 50,
  offset: 0,
  filters: [{ columnId: nameCol.id, operator: 'contains', value: 'Ali' }],
  sorts: [{ columnId: nameCol.id, direction: 'asc' }],
});

// Update a row
await ws.updateRow(row.id, {
  [emailCol.id]: { value: 'alice@newdomain.com' },
});

// Archive / unarchive
await ws.archiveRow(row.id);
await ws.unarchiveRow(row.id);

// Bulk operations
const newRows = await ws.bulkCreateRows([
  { tableId: table.id, cells: { [nameCol.id]: { value: 'Bob' } } },
  { tableId: table.id, cells: { [nameCol.id]: { value: 'Carol' } } },
]);
await ws.bulkDeleteRows(newRows.map(r => r.id));
```

### Views

```typescript
const view = await ws.createView({
  tableId: table.id,
  name: 'Active Contacts',
  type: 'table',
  config: { filters: [], sorts: [] },
});

const views = await ws.getViews(table.id);
await ws.updateView(view.id, { name: 'All Contacts' });
await ws.deleteView(view.id);
```

### Data Table Adapter

Use Data Brain as a drop-in `DatabaseAdapter` for [`@marlinjai/data-table-react`](https://github.com/marlinjai/marlinjai-data-table):

```bash
npm install @marlinjai/data-table-adapter-data-brain
```

```typescript
import { DataBrainAdapter } from '@marlinjai/data-table-adapter-data-brain';

const adapter = new DataBrainAdapter({
  baseUrl: 'https://data-brain-api.marlin-pohl.workers.dev',
  apiKey: 'sk_live_...',
});
```

---

## Deployment

### Prerequisites

- Node.js >= 18
- pnpm
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with Workers and D1 enabled

### Infrastructure (D1 Binding)

Defined in `packages/api/wrangler.toml`:

```toml
name = "data-brain-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "data-brain-db"
database_id = "98254ae4-dc04-44f2-bd00-67b2dd0a3ba4"

[vars]
ENVIRONMENT = "production"

[env.staging]
name = "data-brain-api-staging"
[env.staging.vars]
ENVIRONMENT = "staging"
```

### Database Migrations

Migrations live in `packages/api/migrations/`:

| Migration | Description |
|-----------|-------------|
| `0001_tenants.sql` | Tenants table (id, name, api_key_hash, quotas) |
| `0002_data_tables.sql` | Core data tables (dt_tables, dt_columns, dt_rows, dt_select_options, dt_relations, dt_files, dt_views) |
| `0003_workspaces.sql` | Workspaces table (tenant-scoped, with slug uniqueness) |

```bash
cd packages/api

# Apply migrations locally
wrangler d1 migrations apply data-brain-db --local

# Apply migrations to production
wrangler d1 migrations apply data-brain-db

# Apply migrations to staging
wrangler d1 migrations apply data-brain-db --env staging
```

### Secrets

```bash
cd packages/api

# Set the admin API key (used for POST /api/v1/admin/tenants)
wrangler secret put ADMIN_API_KEY

# For staging
wrangler secret put ADMIN_API_KEY --env staging
```

### Deploy

```bash
cd packages/api

# Deploy to production
wrangler deploy

# Deploy to staging
wrangler deploy --env staging
```

Or from the monorepo root:

```bash
pnpm --filter @data-brain/api deploy
pnpm --filter @data-brain/api deploy:staging
```

---

## Tenant Creation

Tenants are created via the admin endpoint. The response includes the raw API key (only shown once).

```bash
curl -X POST https://data-brain-api.marlin-pohl.workers.dev/api/v1/admin/tenants \
  -H "Authorization: Bearer <ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My App", "quotaRows": 100000, "maxTables": 100}'
```

The returned `apiKey` (prefixed `sk_live_` or `sk_test_`) is used by the tenant for all subsequent API calls.

---

## Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `DB` | D1 binding | Cloudflare D1 database binding |
| `ENVIRONMENT` | wrangler.toml `[vars]` | `production`, `staging`, or `development` |
| `ADMIN_API_KEY` | `wrangler secret` | Secret key for admin endpoints |

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start API dev server (local D1)
pnpm dev

# Run local migrations first
pnpm --filter @data-brain/api db:migrate:local

# Watch SDK for changes
pnpm dev:sdk

# Type-check all packages
pnpm typecheck

# Publish SDK to npm
pnpm publish:sdk
```

### Available Scripts (root)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start the API dev server (`wrangler dev`) |
| `pnpm dev:sdk` | Watch-build the SDK |
| `pnpm build` | Build all packages |
| `pnpm build:sdk` | Build the SDK only |
| `pnpm typecheck` | Type-check all packages |
| `pnpm clean` | Remove dist and .wrangler directories |
| `pnpm publish:sdk` | Build and publish the SDK to npm |

### Available Scripts (packages/api)

| Script | Description |
|--------|-------------|
| `pnpm dev` | `wrangler dev` |
| `pnpm deploy` | `wrangler deploy` |
| `pnpm deploy:staging` | `wrangler deploy --env staging` |
| `pnpm db:migrate` | Apply migrations to production D1 |
| `pnpm db:migrate:local` | Apply migrations to local D1 |

---

## Database Schema

### tenants
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Tenant UUID |
| name | TEXT UNIQUE | Tenant name |
| api_key_hash | TEXT | SHA-256 hash of API key |
| quota_rows | INTEGER | Max rows allowed (default 100,000) |
| used_rows | INTEGER | Current row count |
| max_tables | INTEGER | Max tables allowed (default 100) |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

### workspaces
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Workspace UUID |
| tenant_id | TEXT FK | References tenants(id) |
| name | TEXT | Workspace name |
| slug | TEXT | URL-safe slug (unique per tenant) |
| quota_rows | INTEGER | Optional row quota for workspace |
| used_rows | INTEGER | Current row count |
| metadata | TEXT | JSON metadata |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### dt_tables
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Table UUID |
| workspace_id | TEXT | References workspace |
| name | TEXT | Table name |
| description | TEXT | Optional description |
| icon | TEXT | Optional icon |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### dt_columns
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Column UUID |
| table_id | TEXT FK | References dt_tables(id) CASCADE |
| name | TEXT | Column name |
| type | TEXT | Column type (text, number, email, select, etc.) |
| position | INTEGER | Display order |
| width | INTEGER | Column width in px (default 200) |
| is_primary | INTEGER | 1 if primary display column |
| config | TEXT | JSON configuration |
| created_at | TEXT | ISO timestamp |

### dt_rows
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Row UUID |
| table_id | TEXT FK | References dt_tables(id) CASCADE |
| cells | TEXT | JSON cell data |
| computed | TEXT | Computed values (JSON) |
| _title | TEXT | Extracted primary column value |
| _archived | INTEGER | 1 if archived |
| _created_at | TEXT | ISO timestamp |
| _updated_at | TEXT | ISO timestamp |

### dt_views, dt_select_options, dt_relations, dt_files

See migration `0002_data_tables.sql` for full schema of views, select options, relations, and file reference tables.

---

## License

MIT
