---
title: Quick Start
order: 1
icon: rocket
---

# Quick Start

Get up and running with Data Brain in minutes.

## Prerequisites

- Node.js 18+
- A Data Brain API key (`dbr_live_...` or `dbr_test_...`)

## Install the SDK

```bash
npm install @marlinjai/data-brain-sdk
```

## Create a Client

```typescript
import { DataBrain } from '@marlinjai/data-brain-sdk';

const db = new DataBrain({
  apiKey: 'dbr_live_your_api_key_here',
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
Authorization: Bearer dbr_live_...
```

API keys use the `dbr_live_` prefix for production and `dbr_test_` for testing environments. Keys are hashed with SHA-256 before storage -- the plaintext key is only returned once at creation time.

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

## Next Steps

- [SDK Guide](/sdk) -- Full SDK documentation
- [API Reference](/api-reference) -- Explore all endpoints
- [Architecture](/architecture) -- Understand the system design
