---
title: Self-Hosting Data Brain
description: Run Data Brain on your own infrastructure with Docker
summary: Guide for running Data Brain on your own infrastructure with Docker, covering quick start, tenant creation, and database configuration.
category: documentation
tags: [data-brain, self-hosting, docker, deployment]
projects: [data-brain, self-hosted]
status: active
---

# Self-Hosting Data Brain

Run Data Brain on your own infrastructure with Docker.

## Quick Start

```bash
cd projects/data-brain
docker compose up
```

The API will be available at `http://localhost:3001`.

Or use the all-in-one repo to run both Brain APIs together:

```bash
git clone https://github.com/marlinjai/lumitra-self-hosted
cd lumitra-self-hosted
docker compose up
```

## Create a Tenant

```bash
curl -X POST http://localhost:3001/api/v1/admin/tenants \
  -H "Authorization: Bearer admin-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app"}'
```

Save the `apiKey` from the response — you'll use it with the SDK.

## Use the SDK

```bash
pnpm add @marlinjai/data-brain-sdk
```

```typescript
import { DataBrain } from '@marlinjai/data-brain-sdk';

const client = new DataBrain({
  apiKey: 'sk_live_...',
  baseUrl: 'http://localhost:3001',
});

// Create a table
const table = await client.createTable({ name: 'Tasks' });

// Add a column
await client.createColumn({
  tableId: table.id,
  name: 'Title',
  type: 'text',
  isPrimary: true,
});

// Insert a row
await client.createRow({
  tableId: table.id,
  cells: { [column.id]: 'My first task' },
});
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Postgres connection string |
| `ADMIN_API_KEY` | Yes | — | Admin API key for tenant management |
| `PORT` | No | `3001` | API server port |
| `ENVIRONMENT` | No | `production` | `development`, `staging`, or `production` |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Your App   │────▶│  API        │────▶│  Postgres   │
│  (SDK)      │     │  (Node.js)  │     │  (all data) │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Production Tips

- Replace `ADMIN_API_KEY` with a strong random value
- Use a managed Postgres instance (RDS, Supabase, Neon)
- Put a reverse proxy (nginx/Caddy) in front for TLS
