---
title: Quick Start
order: 1
icon: rocket
---

# Quick Start

Get up and running with Data Brain in minutes.

## Prerequisites

- Node.js 18+
- A Data Brain API key (`sk_live_...` or `sk_test_...`)

## Install the SDK

```bash
npm install @marlinjai/data-brain-sdk
```

## Create a Client

```typescript
import { DataBrain } from '@marlinjai/data-brain-sdk';

const db = new DataBrain({
  apiKey: 'sk_live_your_api_key_here',
});
```

## Create a Table

```typescript
const table = await db.createTable({ name: 'Contacts' });
console.log(table.id); // "tbl_a1b2c3d4-..."
```

## Add Columns

```typescript
await db.createColumn({
  tableId: table.id,
  name: 'Name',
  type: 'text',
  isPrimary: true,
});

await db.createColumn({
  tableId: table.id,
  name: 'Email',
  type: 'text',
});
```

## Add Rows

```typescript
const row = await db.createRow({
  tableId: table.id,
  cells: {
    col_1: { value: 'Alice' },
    col_2: { value: 'alice@example.com' },
  },
});
```

## Query Rows

```typescript
const { rows, total } = await db.getRows(table.id, {
  limit: 50,
  filters: [
    { columnId: 'col_1', operator: 'contains', value: 'Ali' },
  ],
  sorts: [
    { columnId: 'col_1', direction: 'asc' },
  ],
});

console.log(`Found ${total} rows`);
```

## Key Concepts

### Authentication

All API requests require a Bearer token in the `Authorization` header:

```
Authorization: Bearer sk_live_...
```

API keys use the `sk_live_` prefix for production and `sk_test_` for testing environments. Keys are hashed with SHA-256 before storage -- the plaintext key is only returned once at creation time.

### Tenant Isolation

Each API key maps to a tenant. All data is scoped by workspace -- you can only access tables, rows, and other resources that belong to your tenant. Ownership is verified on every request.

### Quotas

Each tenant has configurable limits:

| Quota | Default |
|-------|---------|
| Max rows | 100,000 |
| Max tables | 100 |
| Rate limit | 200 requests/minute |

Check your usage at any time:

```typescript
const info = await db.getTenantInfo();
console.log(`${info.usedRows} / ${info.quotaRows} rows used`);
```

## Working with Workspaces

Workspaces let you partition data within your tenant -- useful for separating data by project, customer, or environment.

### Create a Workspace

```typescript
const workspace = await db.createWorkspace({
  name: 'Production',
  slug: 'production',
});
console.log(workspace.id); // "ws_..."
```

### Scope a Client to a Workspace

Use `withWorkspace()` to return a new client instance that automatically sends `X-Workspace-Id` on every request:

```typescript
const ws = db.withWorkspace(workspace.id);

// All subsequent calls are scoped to this workspace
const table = await ws.createTable({ name: 'Contacts' });
const { rows } = await ws.getRows(table.id);
```

### List and Manage Workspaces

```typescript
// List all workspaces for your tenant
const workspaces = await db.listWorkspaces();

// Fetch a single workspace
const ws = await db.getWorkspace(workspace.id);

// Update a workspace
await db.updateWorkspace(workspace.id, { name: 'Production v2' });

// Delete a workspace (and all its tables and rows)
await db.deleteWorkspace(workspace.id);
```

## Next Steps

- [SDK Guide](/sdk) -- Full SDK documentation
- [API Reference](/api-reference) -- Explore all endpoints
- [Architecture](/architecture) -- Understand the system design
