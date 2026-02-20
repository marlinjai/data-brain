# Data Brain

Structured data as a service — the database equivalent of [Storage Brain](https://github.com/marlinjai/storage-brain).

Data Brain wraps the full [`DatabaseAdapter`](https://github.com/marlinjai/marlinjai-data-table) interface (43 methods) in an HTTP API backed by Cloudflare D1, with a TypeScript SDK for client-side use.

## Packages

| Package | Description | Published |
|---------|-------------|-----------|
| `@data-brain/api` | Cloudflare Workers API (Hono) | Private |
| `@data-brain/shared` | Types, schemas, constants | Private |
| `@marlinjai/data-brain-sdk` | TypeScript SDK | [npm](https://www.npmjs.com/package/@marlinjai/data-brain-sdk) |

## Quick Start

### SDK Usage

```bash
npm install @marlinjai/data-brain-sdk
```

```typescript
import { DataBrain } from '@marlinjai/data-brain-sdk';

const db = new DataBrain({
  baseUrl: 'https://data-brain.your-worker.workers.dev',
  apiKey: 'dbr_live_...',
});

// Create a table
const table = await db.createTable({ name: 'Contacts' });

// Add columns
await db.createColumn(table.id, { name: 'Name', type: 'text', isPrimary: true });
await db.createColumn(table.id, { name: 'Email', type: 'email' });

// Add rows
await db.createRow(table.id, {
  cells: { col_1: { value: 'Alice' }, col_2: { value: 'alice@example.com' } },
});

// Query rows
const { rows, total } = await db.getRows(table.id, { limit: 50 });
```

### Data Table Adapter

Use Data Brain as a drop-in `DatabaseAdapter` for [`@marlinjai/data-table-react`](https://github.com/marlinjai/marlinjai-data-table):

```bash
npm install @marlinjai/data-table-adapter-data-brain
```

```typescript
import { DataBrainAdapter } from '@marlinjai/data-table-adapter-data-brain';

const adapter = new DataBrainAdapter({
  baseUrl: 'https://data-brain.your-worker.workers.dev',
  apiKey: 'dbr_live_...',
});
```

## Architecture

```
Client App
  └── DataBrainAdapter (data-table)
      └── DataBrain SDK (HTTP)
          └── Data Brain API (Cloudflare Worker)
              └── D1Adapter (data-table-adapter-d1)
                  └── Cloudflare D1
```

- **Tenant isolation**: Each API key maps to a tenant; all data is scoped by workspace
- **43 DatabaseAdapter methods**: Tables, columns, rows, views, relations, select options, file references
- **Edge-first**: Runs on Cloudflare Workers with D1 for minimal latency

## Deployment

```bash
# Create D1 database
wrangler d1 create data-brain-db

# Update wrangler.toml with the database_id
# Run migrations
cd packages/api
wrangler d1 migrations apply data-brain-db --local   # local first
wrangler d1 migrations apply data-brain-db            # production

# Set admin secret
wrangler secret put ADMIN_API_KEY

# Deploy
wrangler deploy
```

## Development

```bash
pnpm install
pnpm build        # Build all packages
pnpm dev          # Start API dev server
```

## License

MIT
