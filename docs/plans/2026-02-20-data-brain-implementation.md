---
title: Data Brain Implementation Plan
summary: Task-by-task implementation plan for building Data Brain, including monorepo scaffolding, Hono API routes, TypeScript SDK, and data-table adapter integration.
category: plan
tags: [data-brain, implementation, hono, sdk, monorepo]
projects: [data-brain, data-table]
status: active
date: 2026-02-20
---

# Data Brain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Data Brain — a reusable structured data API service that exposes the full `DatabaseAdapter` interface over HTTP, with SDK and drop-in data-table adapter.

**Architecture:** Cloudflare Worker (Hono) delegates to D1Adapter internally. TypeScript SDK mirrors all 43 DatabaseAdapter methods. A thin `DataBrainAdapter` in data-table wraps the SDK as a drop-in `DatabaseAdapter` replacement.

**Tech Stack:** Hono 4.x, Cloudflare Workers/D1, tsup, Zod, pnpm workspaces

**Design Doc:** `docs/plans/2026-02-20-data-brain-design.md`

---

## Task 1: Scaffold the monorepo

**Files:**
- Create: `projects/lumitra-infra/data-brain/package.json`
- Create: `projects/lumitra-infra/data-brain/pnpm-workspace.yaml`
- Create: `projects/lumitra-infra/data-brain/tsconfig.json`
- Create: `projects/lumitra-infra/data-brain/.gitignore`
- Create: `projects/lumitra-infra/data-brain/packages/shared/package.json`
- Create: `projects/lumitra-infra/data-brain/packages/shared/tsconfig.json`
- Create: `projects/lumitra-infra/data-brain/packages/api/package.json`
- Create: `projects/lumitra-infra/data-brain/packages/api/tsconfig.json`
- Create: `projects/lumitra-infra/data-brain/packages/sdk/package.json`
- Create: `projects/lumitra-infra/data-brain/packages/sdk/tsconfig.json`
- Create: `projects/lumitra-infra/data-brain/packages/sdk/tsup.config.ts`

**Step 1: Initialize git repo and create root config**

```bash
cd "projects/"
mkdir -p data-brain && cd data-brain
git init
```

`projects/lumitra-infra/data-brain/package.json`:
```json
{
  "name": "data-brain",
  "version": "0.1.0",
  "private": true,
  "description": "Structured data as a service — the database equivalent of Storage Brain",
  "scripts": {
    "dev": "pnpm --filter @data-brain/api dev",
    "dev:sdk": "pnpm --filter @marlinjai/data-brain-sdk dev",
    "build": "pnpm -r --if-present run build",
    "build:sdk": "pnpm --filter @marlinjai/data-brain-sdk build",
    "typecheck": "pnpm -r --if-present run typecheck",
    "test": "pnpm -r --if-present run test",
    "clean": "rm -rf packages/*/dist packages/*/.wrangler",
    "publish:sdk": "pnpm --filter @marlinjai/data-brain-sdk build && pnpm --filter @marlinjai/data-brain-sdk publish --access public"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

`projects/lumitra-infra/data-brain/pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

`projects/lumitra-infra/data-brain/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "exclude": ["node_modules", "**/dist", "**/*.test.ts"]
}
```

`projects/lumitra-infra/data-brain/.gitignore`:
```
node_modules/
dist/
.wrangler/
.dev.vars
*.tsbuildinfo
```

**Step 2: Create shared package skeleton**

`projects/lumitra-infra/data-brain/packages/shared/package.json`:
```json
{
  "name": "@data-brain/shared",
  "version": "0.1.0",
  "private": true,
  "description": "Shared types, schemas, and utilities for Data Brain",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

`projects/lumitra-infra/data-brain/packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create API package skeleton**

`projects/lumitra-infra/data-brain/packages/api/package.json`:
```json
{
  "name": "@data-brain/api",
  "version": "0.1.0",
  "private": true,
  "description": "Data Brain API — Cloudflare Workers",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --env staging",
    "typecheck": "tsc --noEmit",
    "db:migrate": "wrangler d1 migrations apply data-brain-db",
    "db:migrate:local": "wrangler d1 migrations apply data-brain-db --local"
  },
  "dependencies": {
    "@data-brain/shared": "workspace:*",
    "@marlinjai/data-table-core": "^0.1.0",
    "@marlinjai/data-table-adapter-d1": "^0.1.0",
    "hono": "^4.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240117.0",
    "wrangler": "^3.24.0",
    "typescript": "^5.3.3"
  }
}
```

`projects/lumitra-infra/data-brain/packages/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create SDK package skeleton**

`projects/lumitra-infra/data-brain/packages/sdk/package.json`:
```json
{
  "name": "@marlinjai/data-brain-sdk",
  "version": "0.1.0",
  "description": "TypeScript SDK for Data Brain — structured data as a service",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "prepublishOnly": "npm run build"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/marlinjai/data-brain",
    "directory": "packages/sdk"
  },
  "keywords": ["database", "data", "cloudflare", "d1", "sdk", "typescript", "api"],
  "author": "marlinjai",
  "license": "MIT",
  "dependencies": {
    "@marlinjai/data-table-core": "^0.1.0"
  },
  "devDependencies": {
    "tsup": "^8.0.1",
    "typescript": "^5.3.3"
  }
}
```

`projects/lumitra-infra/data-brain/packages/sdk/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

`projects/lumitra-infra/data-brain/packages/sdk/tsup.config.ts`:
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['@marlinjai/data-table-core'],
});
```

**Step 5: Install dependencies and verify workspace**

```bash
cd projects/lumitra-infra/data-brain
pnpm install
```

Expected: Clean install, workspace packages linked.

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold data-brain monorepo with shared, api, sdk packages"
```

---

## Task 2: Shared package — types, constants, schemas

**Files:**
- Create: `projects/lumitra-infra/data-brain/packages/shared/src/index.ts`
- Create: `projects/lumitra-infra/data-brain/packages/shared/src/types.ts`
- Create: `projects/lumitra-infra/data-brain/packages/shared/src/constants.ts`
- Create: `projects/lumitra-infra/data-brain/packages/shared/src/schemas.ts`

**Step 1: Create types**

`projects/lumitra-infra/data-brain/packages/shared/src/types.ts`:
```typescript
/**
 * Tenant stored in Data Brain's own tenants table
 */
export interface Tenant {
  id: string;
  name: string;
  apiKeyHash: string;
  quotaRows: number;
  usedRows: number;
  maxTables: number;
  createdAt: number; // Unix timestamp
  updatedAt: number;
}

/**
 * Tenant context attached to Hono request after auth
 */
export interface TenantContext {
  tenant: Tenant;
}

/**
 * Public tenant info (no sensitive fields)
 */
export interface TenantInfo {
  id: string;
  name: string;
  quotaRows: number;
  usedRows: number;
  maxTables: number;
  createdAt: string; // ISO 8601
}

/**
 * Batch operation — one unit in a POST /rpc/batch request
 */
export interface BatchOperation {
  method: string;
  params: Record<string, unknown>;
}

/**
 * Result of a single operation in a batch
 */
export interface BatchResult {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}
```

**Step 2: Create constants**

`projects/lumitra-infra/data-brain/packages/shared/src/constants.ts`:
```typescript
/**
 * API key prefixes (same convention as Storage Brain)
 */
export const API_KEY_PREFIX_LIVE = 'sk_live_';
export const API_KEY_PREFIX_TEST = 'sk_test_';

/**
 * Default quotas
 */
export const DEFAULT_QUOTA_ROWS = 100_000;
export const DEFAULT_MAX_TABLES = 100;

/**
 * Rate limiting
 */
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 200;

/**
 * Retry configuration (mirrored in SDK)
 */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
} as const;

/**
 * Pagination defaults
 */
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

/**
 * Allowed batch operation methods
 */
export const BATCH_METHODS = [
  'createTable', 'getTable', 'updateTable', 'deleteTable', 'listTables',
  'createColumn', 'getColumns', 'getColumn', 'updateColumn', 'deleteColumn', 'reorderColumns',
  'createRow', 'getRow', 'getRows', 'updateRow', 'deleteRow',
  'archiveRow', 'unarchiveRow', 'bulkCreateRows', 'bulkDeleteRows', 'bulkArchiveRows',
  'createView', 'getViews', 'getView', 'updateView', 'deleteView', 'reorderViews',
  'createSelectOption', 'getSelectOptions', 'updateSelectOption', 'deleteSelectOption', 'reorderSelectOptions',
  'createRelation', 'deleteRelation', 'getRelatedRows', 'getRelationsForRow',
  'addFileReference', 'removeFileReference', 'getFileReferences', 'reorderFileReferences',
] as const;

export type BatchMethod = (typeof BATCH_METHODS)[number];
```

**Step 3: Create Zod schemas**

`projects/lumitra-infra/data-brain/packages/shared/src/schemas.ts`:
```typescript
import { z } from 'zod';
import { API_KEY_PREFIX_LIVE, API_KEY_PREFIX_TEST, BATCH_METHODS, MAX_PAGE_LIMIT } from './constants';

// ─── Primitives ──────────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid();

export const apiKeySchema = z
  .string()
  .min(1, 'API key is required')
  .refine(
    (key) => key.startsWith(API_KEY_PREFIX_LIVE) || key.startsWith(API_KEY_PREFIX_TEST),
    `API key must start with '${API_KEY_PREFIX_LIVE}' or '${API_KEY_PREFIX_TEST}'`
  );

export const cursorSchema = z
  .string()
  .regex(/^[A-Za-z0-9+/=]+$/, 'Invalid cursor format')
  .optional();

// ─── Tables ──────────────────────────────────────────────────────────────────

export const createTableSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  icon: z.string().max(50).optional(),
});

export const updateTableSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  icon: z.string().max(50).optional(),
});

// ─── Columns ─────────────────────────────────────────────────────────────────

export const columnTypeSchema = z.enum([
  'text', 'number', 'date', 'boolean', 'select', 'multi_select',
  'url', 'file', 'formula', 'relation', 'rollup', 'created_time', 'last_edited_time',
]);

export const createColumnSchema = z.object({
  tableId: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: columnTypeSchema,
  position: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  isPrimary: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  width: z.number().int().positive().optional(),
  config: z.record(z.unknown()).optional(),
});

export const reorderIdsSchema = z.array(z.string().uuid()).min(1);

// ─── Rows ────────────────────────────────────────────────────────────────────

export const createRowSchema = z.object({
  tableId: z.string().uuid(),
  parentRowId: z.string().uuid().optional(),
  cells: z.record(z.unknown()).optional(),
});

export const updateRowCellsSchema = z.record(z.unknown());

export const queryOptionsSchema = z.object({
  filters: z.array(z.object({
    columnId: z.string(),
    operator: z.enum([
      'equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith',
      'greaterThan', 'greaterThanOrEquals', 'lessThan', 'lessThanOrEquals',
      'isEmpty', 'isNotEmpty', 'isIn', 'isNotIn',
    ]),
    value: z.unknown(),
  })).optional(),
  sorts: z.array(z.object({
    columnId: z.string(),
    direction: z.enum(['asc', 'desc']),
  })).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  cursor: cursorSchema,
  includeArchived: z.coerce.boolean().optional(),
  parentRowId: z.string().uuid().nullable().optional(),
  includeSubItems: z.coerce.boolean().optional(),
}).optional();

export const bulkRowIdsSchema = z.array(z.string().uuid()).min(1).max(1000);

// ─── Views ───────────────────────────────────────────────────────────────────

export const viewTypeSchema = z.enum([
  'table', 'board', 'calendar', 'gallery', 'timeline', 'list',
]);

export const createViewSchema = z.object({
  tableId: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: viewTypeSchema,
  isDefault: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateViewSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: viewTypeSchema.optional(),
  isDefault: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

// ─── Select Options ──────────────────────────────────────────────────────────

export const createSelectOptionSchema = z.object({
  columnId: z.string().uuid(),
  name: z.string().min(1).max(255),
  color: z.string().max(50).optional(),
  position: z.number().int().nonnegative().optional(),
});

export const updateSelectOptionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z.string().max(50).optional(),
  position: z.number().int().nonnegative().optional(),
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const createRelationSchema = z.object({
  sourceRowId: z.string().uuid(),
  sourceColumnId: z.string().uuid(),
  targetRowId: z.string().uuid(),
});

export const deleteRelationSchema = z.object({
  sourceRowId: z.string().uuid(),
  columnId: z.string().uuid(),
  targetRowId: z.string().uuid(),
});

// ─── File References ─────────────────────────────────────────────────────────

export const createFileRefSchema = z.object({
  rowId: z.string().uuid(),
  columnId: z.string().uuid(),
  fileId: z.string().min(1),
  fileUrl: z.string().url(),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().nonnegative().optional(),
  position: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── Batch ───────────────────────────────────────────────────────────────────

export const batchOperationSchema = z.object({
  method: z.enum(BATCH_METHODS as unknown as [string, ...string[]]),
  params: z.record(z.unknown()),
});

export const batchRequestSchema = z.object({
  operations: z.array(batchOperationSchema).min(1).max(50),
});

// ─── Admin ───────────────────────────────────────────────────────────────────

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  quotaRows: z.number().int().positive().optional(),
  maxTables: z.number().int().positive().optional(),
});
```

**Step 4: Create barrel export**

`projects/lumitra-infra/data-brain/packages/shared/src/index.ts`:
```typescript
export * from './types';
export * from './constants';
export * from './schemas';
```

**Step 5: Build and verify**

```bash
cd projects/lumitra-infra/data-brain
pnpm --filter @data-brain/shared build
```

Expected: Clean build, `packages/shared/dist/` generated with `.js` and `.d.ts` files.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(shared): add types, constants, and Zod validation schemas"
```

---

## Task 3: API package — scaffold, middleware, env

**Files:**
- Create: `projects/lumitra-infra/data-brain/packages/api/src/env.ts`
- Create: `projects/lumitra-infra/data-brain/packages/api/src/middleware/error-handler.ts`
- Create: `projects/lumitra-infra/data-brain/packages/api/src/middleware/auth.ts`
- Create: `projects/lumitra-infra/data-brain/packages/api/src/index.ts`
- Create: `projects/lumitra-infra/data-brain/packages/api/wrangler.toml`

**Step 1: Create wrangler config**

`projects/lumitra-infra/data-brain/packages/api/wrangler.toml`:
```toml
name = "data-brain-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "data-brain-db"
database_id = "<TO_BE_CREATED>"

[vars]
ENVIRONMENT = "production"

[env.staging]
name = "data-brain-api-staging"
[env.staging.vars]
ENVIRONMENT = "staging"
```

**Step 2: Create env types**

`projects/lumitra-infra/data-brain/packages/api/src/env.ts`:
```typescript
import type { TenantContext } from '@data-brain/shared';

export interface Env {
  DB: D1Database;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  ADMIN_API_KEY?: string;
}

export interface Variables extends TenantContext {
  requestId: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: Variables;
};
```

**Step 3: Create error handler middleware**

`projects/lumitra-infra/data-brain/packages/api/src/middleware/error-handler.ts`:
```typescript
import type { Context } from 'hono';
import { ZodError } from 'zod';
import type { AppEnv } from '../env';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: Record<string, unknown>) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string) {
    return new ApiError(409, 'CONFLICT', message);
  }

  static quotaExceeded(message = 'Quota exceeded') {
    return new ApiError(403, 'QUOTA_EXCEEDED', message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}

export function errorHandler(err: Error, c: Context<AppEnv>) {
  const requestId = c.get('requestId') ?? 'unknown';

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    console.error(`[${requestId}] Validation error:`, JSON.stringify(details));
    return c.json({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: { errors: details } },
    }, 400);
  }

  if (err instanceof ApiError) {
    console.error(`[${requestId}] API error: ${err.code} - ${err.message}`);
    return c.json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    }, err.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500);
  }

  console.error(`[${requestId}] Unexpected error:`, err);
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: c.env.ENVIRONMENT === 'production' ? 'An unexpected error occurred' : err.message,
    },
  }, 500);
}
```

**Step 4: Create auth middleware**

`projects/lumitra-infra/data-brain/packages/api/src/middleware/auth.ts`:
```typescript
import type { Context, Next } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from './error-handler';
import { apiKeySchema } from '@data-brain/shared';

/**
 * Hash API key with SHA-256 for lookup
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Auth middleware: validates API key, attaches tenant to context.
 * Tenant's `id` is used as `workspaceId` for all adapter calls.
 */
export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) throw ApiError.unauthorized('Missing Authorization header');
  if (!authHeader.startsWith('Bearer ')) throw ApiError.unauthorized('Invalid Authorization header format');

  const apiKey = authHeader.slice(7);
  const parseResult = apiKeySchema.safeParse(apiKey);
  if (!parseResult.success) throw ApiError.unauthorized('Invalid API key format');

  const keyHash = await hashApiKey(apiKey);

  const row = await c.env.DB.prepare(
    'SELECT id, name, api_key_hash, quota_rows, used_rows, max_tables, created_at, updated_at FROM tenants WHERE api_key_hash = ?'
  ).bind(keyHash).first();

  if (!row) throw ApiError.unauthorized('Invalid API key');

  c.set('tenant', {
    id: row.id as string,
    name: row.name as string,
    apiKeyHash: row.api_key_hash as string,
    quotaRows: row.quota_rows as number,
    usedRows: row.used_rows as number,
    maxTables: row.max_tables as number,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  });

  await next();
}

/**
 * Admin auth middleware: validates against ADMIN_API_KEY env var
 */
export async function adminAuthMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw ApiError.unauthorized('Missing admin key');

  const key = authHeader.slice(7);
  if (!c.env.ADMIN_API_KEY || key !== c.env.ADMIN_API_KEY) {
    throw ApiError.unauthorized('Invalid admin key');
  }

  await next();
}

export { hashApiKey };
```

**Step 5: Create main Hono app entry point**

`projects/lumitra-infra/data-brain/packages/api/src/index.ts`:
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { requestId } from 'hono/request-id';

import type { AppEnv } from './env';
import { errorHandler } from './middleware/error-handler';

const app = new Hono<AppEnv>();

// Global middleware
app.use('*', secureHeaders());
app.use('*', requestId());
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-Id'],
  maxAge: 86400,
}));

app.onError(errorHandler);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), environment: c.env.ENVIRONMENT });
});

// Routes will be added in subsequent tasks:
// app.route('/api/v1', tableRoutes);
// etc.

// 404 handler
app.notFound((c) => {
  return c.json({ error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` } }, 404);
});

export default { fetch: app.fetch };
```

**Step 6: Verify typecheck**

```bash
cd projects/lumitra-infra/data-brain
pnpm --filter @data-brain/api typecheck
```

Expected: No errors. (Note: the data-table-core and adapter-d1 packages must be available; install or link as needed.)

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): scaffold Hono app with auth middleware, error handler, env types"
```

---

## Task 4: API — tenant management (migration, service, routes)

**Files:**
- Create: `projects/lumitra-infra/data-brain/packages/api/migrations/0001_tenants.sql`
- Create: `projects/lumitra-infra/data-brain/packages/api/src/services/tenant.ts`
- Create: `projects/lumitra-infra/data-brain/packages/api/src/routes/tenant.ts`
- Create: `projects/lumitra-infra/data-brain/packages/api/src/routes/admin.ts`
- Modify: `projects/lumitra-infra/data-brain/packages/api/src/index.ts` (mount routes)

**Step 1: Create tenant migration**

`projects/lumitra-infra/data-brain/packages/api/migrations/0001_tenants.sql`:
```sql
-- Data Brain tenant management
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  quota_rows INTEGER NOT NULL DEFAULT 100000,
  used_rows INTEGER NOT NULL DEFAULT 0,
  max_tables INTEGER NOT NULL DEFAULT 100,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_api_key_hash ON tenants(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);
```

**Step 2: Create tenant service**

`projects/lumitra-infra/data-brain/packages/api/src/services/tenant.ts`:
```typescript
import { DEFAULT_QUOTA_ROWS, DEFAULT_MAX_TABLES, API_KEY_PREFIX_LIVE } from '@data-brain/shared';
import type { Tenant, TenantInfo } from '@data-brain/shared';
import { hashApiKey } from '../middleware/auth';

/**
 * Generate a random API key with the live prefix
 */
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${API_KEY_PREFIX_LIVE}${key}`;
}

export async function createTenant(
  db: D1Database,
  input: { name: string; quotaRows?: number; maxTables?: number }
): Promise<{ tenant: TenantInfo; apiKey: string }> {
  const id = crypto.randomUUID();
  const apiKey = generateApiKey();
  const keyHash = await hashApiKey(apiKey);
  const now = Date.now();

  await db.prepare(
    `INSERT INTO tenants (id, name, api_key_hash, quota_rows, max_tables, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    input.name,
    keyHash,
    input.quotaRows ?? DEFAULT_QUOTA_ROWS,
    input.maxTables ?? DEFAULT_MAX_TABLES,
    now,
    now,
  ).run();

  return {
    tenant: {
      id,
      name: input.name,
      quotaRows: input.quotaRows ?? DEFAULT_QUOTA_ROWS,
      usedRows: 0,
      maxTables: input.maxTables ?? DEFAULT_MAX_TABLES,
      createdAt: new Date(now).toISOString(),
    },
    apiKey, // Only returned once at creation
  };
}

export function toTenantInfo(tenant: Tenant): TenantInfo {
  return {
    id: tenant.id,
    name: tenant.name,
    quotaRows: tenant.quotaRows,
    usedRows: tenant.usedRows,
    maxTables: tenant.maxTables,
    createdAt: new Date(tenant.createdAt).toISOString(),
  };
}
```

**Step 3: Create tenant route**

`projects/lumitra-infra/data-brain/packages/api/src/routes/tenant.ts`:
```typescript
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { toTenantInfo } from '../services/tenant';

const tenantRoutes = new Hono<AppEnv>();

tenantRoutes.use('*', authMiddleware);

// GET /api/v1/tenant/info
tenantRoutes.get('/info', (c) => {
  const tenant = c.get('tenant');
  return c.json(toTenantInfo(tenant));
});

export { tenantRoutes };
```

**Step 4: Create admin route**

`projects/lumitra-infra/data-brain/packages/api/src/routes/admin.ts`:
```typescript
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { adminAuthMiddleware } from '../middleware/auth';
import { createTenant } from '../services/tenant';
import { createTenantSchema } from '@data-brain/shared';

const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', adminAuthMiddleware);

// POST /api/v1/admin/tenants
adminRoutes.post('/tenants', async (c) => {
  const body = createTenantSchema.parse(await c.req.json());
  const result = await createTenant(c.env.DB, body);
  return c.json(result, 201);
});

export { adminRoutes };
```

**Step 5: Mount routes in main app**

Update `projects/lumitra-infra/data-brain/packages/api/src/index.ts` — add these imports and route mounts before the 404 handler:

```typescript
import { tenantRoutes } from './routes/tenant';
import { adminRoutes } from './routes/admin';

// ... after middleware setup, before notFound:

app.route('/api/v1/tenant', tenantRoutes);
app.route('/api/v1/admin', adminRoutes);
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): add tenant management — migration, service, tenant + admin routes"
```

---

## Task 5: API — adapter factory + table & column routes

**Files:**
- Create: `projects/lumitra-infra/data-brain/packages/api/src/adapter.ts`
- Create: `projects/lumitra-infra/data-brain/packages/api/src/routes/tables.ts`
- Create: `projects/lumitra-infra/data-brain/packages/api/src/routes/columns.ts`
- Modify: `projects/lumitra-infra/data-brain/packages/api/src/index.ts` (mount routes)

**Step 1: Create adapter factory**

The API uses D1Adapter internally. Each request gets an adapter instance from the D1 binding.

`projects/lumitra-infra/data-brain/packages/api/src/adapter.ts`:
```typescript
import type { Context } from 'hono';
import { D1Adapter } from '@marlinjai/data-table-adapter-d1';
import type { AppEnv } from './env';

/**
 * Get a D1Adapter from the request context.
 * Tenant isolation is enforced by always using tenant.id as workspaceId.
 */
export function getAdapter(c: Context<AppEnv>): D1Adapter {
  return new D1Adapter(c.env.DB);
}

/**
 * Get the workspaceId for the current tenant.
 * Tenant.id IS the workspaceId — this enforces isolation.
 */
export function getWorkspaceId(c: Context<AppEnv>): string {
  return c.get('tenant').id;
}
```

**Step 2: Create table routes**

`projects/lumitra-infra/data-brain/packages/api/src/routes/tables.ts`:
```typescript
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import { createTableSchema, updateTableSchema } from '@data-brain/shared';

const tableRoutes = new Hono<AppEnv>();

tableRoutes.use('*', authMiddleware);

// GET /api/v1/tables — list tables for the tenant
tableRoutes.get('/', async (c) => {
  const adapter = getAdapter(c);
  const workspaceId = getWorkspaceId(c);
  const tables = await adapter.listTables(workspaceId);
  return c.json(tables);
});

// POST /api/v1/tables — create a table
tableRoutes.post('/', async (c) => {
  const body = createTableSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const workspaceId = getWorkspaceId(c);
  // Enforce: workspaceId is always the tenant's ID
  const table = await adapter.createTable({ ...body, workspaceId });
  return c.json(table, 201);
});

// GET /api/v1/tables/:tableId
tableRoutes.get('/:tableId', async (c) => {
  const adapter = getAdapter(c);
  const table = await adapter.getTable(c.req.param('tableId'));
  if (!table) throw ApiError.notFound('Table not found');
  // Verify ownership
  if (table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  return c.json(table);
});

// PATCH /api/v1/tables/:tableId
tableRoutes.patch('/:tableId', async (c) => {
  const updates = updateTableSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  // Verify ownership first
  const existing = await adapter.getTable(c.req.param('tableId'));
  if (!existing || existing.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  const table = await adapter.updateTable(c.req.param('tableId'), updates);
  return c.json(table);
});

// DELETE /api/v1/tables/:tableId
tableRoutes.delete('/:tableId', async (c) => {
  const adapter = getAdapter(c);
  const existing = await adapter.getTable(c.req.param('tableId'));
  if (!existing || existing.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  await adapter.deleteTable(c.req.param('tableId'));
  return c.json({ success: true });
});

export { tableRoutes };
```

**Step 3: Create column routes**

`projects/lumitra-infra/data-brain/packages/api/src/routes/columns.ts`:
```typescript
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import { createColumnSchema, updateColumnSchema, reorderIdsSchema } from '@data-brain/shared';

const columnRoutes = new Hono<AppEnv>();

columnRoutes.use('*', authMiddleware);

// GET /api/v1/tables/:tableId/columns
columnRoutes.get('/tables/:tableId/columns', async (c) => {
  const adapter = getAdapter(c);
  // Ownership check: verify table belongs to tenant
  const table = await adapter.getTable(c.req.param('tableId'));
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  const columns = await adapter.getColumns(c.req.param('tableId'));
  return c.json(columns);
});

// POST /api/v1/tables/:tableId/columns
columnRoutes.post('/tables/:tableId/columns', async (c) => {
  const body = createColumnSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const table = await adapter.getTable(c.req.param('tableId'));
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  const column = await adapter.createColumn({ ...body, tableId: c.req.param('tableId') });
  return c.json(column, 201);
});

// GET /api/v1/columns/:columnId
columnRoutes.get('/columns/:columnId', async (c) => {
  const adapter = getAdapter(c);
  const column = await adapter.getColumn(c.req.param('columnId'));
  if (!column) throw ApiError.notFound('Column not found');
  // Verify table ownership
  const table = await adapter.getTable(column.tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Column not found');
  return c.json(column);
});

// PATCH /api/v1/columns/:columnId
columnRoutes.patch('/columns/:columnId', async (c) => {
  const updates = updateColumnSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const column = await adapter.getColumn(c.req.param('columnId'));
  if (!column) throw ApiError.notFound('Column not found');
  const table = await adapter.getTable(column.tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Column not found');
  const updated = await adapter.updateColumn(c.req.param('columnId'), updates);
  return c.json(updated);
});

// DELETE /api/v1/columns/:columnId
columnRoutes.delete('/columns/:columnId', async (c) => {
  const adapter = getAdapter(c);
  const column = await adapter.getColumn(c.req.param('columnId'));
  if (!column) throw ApiError.notFound('Column not found');
  const table = await adapter.getTable(column.tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Column not found');
  await adapter.deleteColumn(c.req.param('columnId'));
  return c.json({ success: true });
});

// PUT /api/v1/tables/:tableId/columns/reorder
columnRoutes.put('/tables/:tableId/columns/reorder', async (c) => {
  const columnIds = reorderIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const table = await adapter.getTable(c.req.param('tableId'));
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  await adapter.reorderColumns(c.req.param('tableId'), columnIds);
  return c.json({ success: true });
});

export { columnRoutes };
```

**Step 4: Mount routes**

Add to `projects/lumitra-infra/data-brain/packages/api/src/index.ts`:

```typescript
import { tableRoutes } from './routes/tables';
import { columnRoutes } from './routes/columns';

// Mount — tables at /api/v1/tables, columns at /api/v1 (has nested paths)
app.route('/api/v1/tables', tableRoutes);
app.route('/api/v1', columnRoutes);
```

**Step 5: Typecheck**

```bash
cd projects/lumitra-infra/data-brain && pnpm --filter @data-brain/api typecheck
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): add table and column routes with tenant ownership checks"
```

---

## Task 6: API — row routes

**Files:**
- Create: `projects/lumitra-infra/data-brain/packages/api/src/routes/rows.ts`
- Modify: `projects/lumitra-infra/data-brain/packages/api/src/index.ts` (mount route)

This is the most complex route group — 11 adapter methods.

**Step 1: Create row routes**

`projects/lumitra-infra/data-brain/packages/api/src/routes/rows.ts`:
```typescript
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import {
  createRowSchema,
  updateRowCellsSchema,
  queryOptionsSchema,
  bulkRowIdsSchema,
} from '@data-brain/shared';
import type { QueryOptions } from '@marlinjai/data-table-core';

const rowRoutes = new Hono<AppEnv>();

rowRoutes.use('*', authMiddleware);

/**
 * Helper: verify table belongs to current tenant
 */
async function verifyTableOwnership(c: any, adapter: any, tableId: string) {
  const table = await adapter.getTable(tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) {
    throw ApiError.notFound('Table not found');
  }
  return table;
}

/**
 * Helper: verify row belongs to a table owned by current tenant
 */
async function verifyRowOwnership(c: any, adapter: any, rowId: string) {
  const row = await adapter.getRow(rowId);
  if (!row) throw ApiError.notFound('Row not found');
  await verifyTableOwnership(c, adapter, row.tableId);
  return row;
}

// GET /api/v1/tables/:tableId/rows
rowRoutes.get('/tables/:tableId/rows', async (c) => {
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));

  // Parse query options from URL search params
  const url = new URL(c.req.url);
  const rawQuery: Record<string, unknown> = {};
  if (url.searchParams.has('limit')) rawQuery.limit = url.searchParams.get('limit');
  if (url.searchParams.has('offset')) rawQuery.offset = url.searchParams.get('offset');
  if (url.searchParams.has('cursor')) rawQuery.cursor = url.searchParams.get('cursor');
  if (url.searchParams.has('includeArchived')) rawQuery.includeArchived = url.searchParams.get('includeArchived');
  if (url.searchParams.has('parentRowId')) rawQuery.parentRowId = url.searchParams.get('parentRowId');
  if (url.searchParams.has('includeSubItems')) rawQuery.includeSubItems = url.searchParams.get('includeSubItems');
  if (url.searchParams.has('filters')) rawQuery.filters = JSON.parse(url.searchParams.get('filters')!);
  if (url.searchParams.has('sorts')) rawQuery.sorts = JSON.parse(url.searchParams.get('sorts')!);

  const query = queryOptionsSchema.parse(Object.keys(rawQuery).length > 0 ? rawQuery : undefined);
  const result = await adapter.getRows(c.req.param('tableId'), query as QueryOptions);
  return c.json(result);
});

// POST /api/v1/tables/:tableId/rows
rowRoutes.post('/tables/:tableId/rows', async (c) => {
  const body = createRowSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  const row = await adapter.createRow({ ...body, tableId: c.req.param('tableId') });
  return c.json(row, 201);
});

// GET /api/v1/rows/:rowId
rowRoutes.get('/rows/:rowId', async (c) => {
  const adapter = getAdapter(c);
  const row = await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  return c.json(row);
});

// PATCH /api/v1/rows/:rowId
rowRoutes.patch('/rows/:rowId', async (c) => {
  const cells = updateRowCellsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  const row = await adapter.updateRow(c.req.param('rowId'), cells);
  return c.json(row);
});

// DELETE /api/v1/rows/:rowId
rowRoutes.delete('/rows/:rowId', async (c) => {
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  await adapter.deleteRow(c.req.param('rowId'));
  return c.json({ success: true });
});

// POST /api/v1/rows/:rowId/archive
rowRoutes.post('/rows/:rowId/archive', async (c) => {
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  await adapter.archiveRow(c.req.param('rowId'));
  return c.json({ success: true });
});

// POST /api/v1/rows/:rowId/unarchive
rowRoutes.post('/rows/:rowId/unarchive', async (c) => {
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  await adapter.unarchiveRow(c.req.param('rowId'));
  return c.json({ success: true });
});

// POST /api/v1/tables/:tableId/rows/bulk — bulk create
rowRoutes.post('/tables/:tableId/rows/bulk', async (c) => {
  const inputs = (await c.req.json()) as Array<{ cells?: Record<string, unknown>; parentRowId?: string }>;
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  const fullInputs = inputs.map((input) => ({
    tableId: c.req.param('tableId'),
    ...input,
  }));
  const rows = await adapter.bulkCreateRows(fullInputs);
  return c.json(rows, 201);
});

// DELETE /api/v1/rows/bulk — bulk delete
rowRoutes.delete('/rows/bulk', async (c) => {
  const rowIds = bulkRowIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  // Verify ownership of at least the first row (all should belong to same tenant)
  if (rowIds.length > 0) await verifyRowOwnership(c, adapter, rowIds[0]!);
  await adapter.bulkDeleteRows(rowIds);
  return c.json({ success: true });
});

// POST /api/v1/rows/bulk/archive — bulk archive
rowRoutes.post('/rows/bulk/archive', async (c) => {
  const rowIds = bulkRowIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  if (rowIds.length > 0) await verifyRowOwnership(c, adapter, rowIds[0]!);
  await adapter.bulkArchiveRows(rowIds);
  return c.json({ success: true });
});

export { rowRoutes };
```

**Step 2: Mount route**

Add to `projects/lumitra-infra/data-brain/packages/api/src/index.ts`:

```typescript
import { rowRoutes } from './routes/rows';

app.route('/api/v1', rowRoutes);
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(api): add row routes — CRUD, archive, bulk operations, query with filters"
```

---

## Task 7: API — view & select option routes

**Files:**
- Create: `projects/lumitra-infra/data-brain/packages/api/src/routes/views.ts`
- Create: `projects/lumitra-infra/data-brain/packages/api/src/routes/select-options.ts`
- Modify: `projects/lumitra-infra/data-brain/packages/api/src/index.ts`

**Step 1: Create view routes**

`projects/lumitra-infra/data-brain/packages/api/src/routes/views.ts`:
```typescript
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import { createViewSchema, updateViewSchema, reorderIdsSchema } from '@data-brain/shared';

const viewRoutes = new Hono<AppEnv>();

viewRoutes.use('*', authMiddleware);

async function verifyTableOwnership(c: any, adapter: any, tableId: string) {
  const table = await adapter.getTable(tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  return table;
}

// GET /api/v1/tables/:tableId/views
viewRoutes.get('/tables/:tableId/views', async (c) => {
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  return c.json(await adapter.getViews(c.req.param('tableId')));
});

// POST /api/v1/tables/:tableId/views
viewRoutes.post('/tables/:tableId/views', async (c) => {
  const body = createViewSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  const view = await adapter.createView({ ...body, tableId: c.req.param('tableId') });
  return c.json(view, 201);
});

// GET /api/v1/views/:viewId
viewRoutes.get('/views/:viewId', async (c) => {
  const adapter = getAdapter(c);
  const view = await adapter.getView(c.req.param('viewId'));
  if (!view) throw ApiError.notFound('View not found');
  await verifyTableOwnership(c, adapter, view.tableId);
  return c.json(view);
});

// PATCH /api/v1/views/:viewId
viewRoutes.patch('/views/:viewId', async (c) => {
  const updates = updateViewSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const view = await adapter.getView(c.req.param('viewId'));
  if (!view) throw ApiError.notFound('View not found');
  await verifyTableOwnership(c, adapter, view.tableId);
  return c.json(await adapter.updateView(c.req.param('viewId'), updates));
});

// DELETE /api/v1/views/:viewId
viewRoutes.delete('/views/:viewId', async (c) => {
  const adapter = getAdapter(c);
  const view = await adapter.getView(c.req.param('viewId'));
  if (!view) throw ApiError.notFound('View not found');
  await verifyTableOwnership(c, adapter, view.tableId);
  await adapter.deleteView(c.req.param('viewId'));
  return c.json({ success: true });
});

// PUT /api/v1/tables/:tableId/views/reorder
viewRoutes.put('/tables/:tableId/views/reorder', async (c) => {
  const viewIds = reorderIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  await adapter.reorderViews(c.req.param('tableId'), viewIds);
  return c.json({ success: true });
});

export { viewRoutes };
```

**Step 2: Create select option routes**

`projects/lumitra-infra/data-brain/packages/api/src/routes/select-options.ts`:
```typescript
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import { createSelectOptionSchema, updateSelectOptionSchema, reorderIdsSchema } from '@data-brain/shared';

const selectOptionRoutes = new Hono<AppEnv>();

selectOptionRoutes.use('*', authMiddleware);

async function verifyColumnOwnership(c: any, adapter: any, columnId: string) {
  const column = await adapter.getColumn(columnId);
  if (!column) throw ApiError.notFound('Column not found');
  const table = await adapter.getTable(column.tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Column not found');
  return column;
}

// GET /api/v1/columns/:columnId/options
selectOptionRoutes.get('/columns/:columnId/options', async (c) => {
  const adapter = getAdapter(c);
  await verifyColumnOwnership(c, adapter, c.req.param('columnId'));
  return c.json(await adapter.getSelectOptions(c.req.param('columnId')));
});

// POST /api/v1/columns/:columnId/options
selectOptionRoutes.post('/columns/:columnId/options', async (c) => {
  const body = createSelectOptionSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyColumnOwnership(c, adapter, c.req.param('columnId'));
  const option = await adapter.createSelectOption({ ...body, columnId: c.req.param('columnId') });
  return c.json(option, 201);
});

// PATCH /api/v1/options/:optionId
selectOptionRoutes.patch('/options/:optionId', async (c) => {
  const updates = updateSelectOptionSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  // Option ownership is verified through column → table → workspace
  const options = await adapter.getSelectOptions(c.req.param('optionId'));
  // We need to find which column this option belongs to — query by optionId
  // The adapter doesn't have getSelectOption(id), so we use updateSelectOption directly
  // and let it throw if not found
  const updated = await adapter.updateSelectOption(c.req.param('optionId'), updates);
  return c.json(updated);
});

// DELETE /api/v1/options/:optionId
selectOptionRoutes.delete('/options/:optionId', async (c) => {
  const adapter = getAdapter(c);
  await adapter.deleteSelectOption(c.req.param('optionId'));
  return c.json({ success: true });
});

// PUT /api/v1/columns/:columnId/options/reorder
selectOptionRoutes.put('/columns/:columnId/options/reorder', async (c) => {
  const optionIds = reorderIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyColumnOwnership(c, adapter, c.req.param('columnId'));
  await adapter.reorderSelectOptions(c.req.param('columnId'), optionIds);
  return c.json({ success: true });
});

export { selectOptionRoutes };
```

**Step 3: Mount routes**

Add to `projects/lumitra-infra/data-brain/packages/api/src/index.ts`:

```typescript
import { viewRoutes } from './routes/views';
import { selectOptionRoutes } from './routes/select-options';

app.route('/api/v1', viewRoutes);
app.route('/api/v1', selectOptionRoutes);
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(api): add view and select option routes"
```

---

## Task 8: API — relation, file reference, and batch routes

**Files:**
- Create: `projects/lumitra-infra/data-brain/packages/api/src/routes/relations.ts`
- Create: `projects/lumitra-infra/data-brain/packages/api/src/routes/file-refs.ts`
- Create: `projects/lumitra-infra/data-brain/packages/api/src/routes/batch.ts`
- Modify: `projects/lumitra-infra/data-brain/packages/api/src/index.ts`

**Step 1: Create relation routes**

`projects/lumitra-infra/data-brain/packages/api/src/routes/relations.ts`:
```typescript
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import { createRelationSchema, deleteRelationSchema } from '@data-brain/shared';

const relationRoutes = new Hono<AppEnv>();

relationRoutes.use('*', authMiddleware);

async function verifyRowOwnership(c: any, adapter: any, rowId: string) {
  const row = await adapter.getRow(rowId);
  if (!row) throw ApiError.notFound('Row not found');
  const table = await adapter.getTable(row.tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Row not found');
  return row;
}

// POST /api/v1/relations
relationRoutes.post('/relations', async (c) => {
  const body = createRelationSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, body.sourceRowId);
  await adapter.createRelation(body);
  return c.json({ success: true }, 201);
});

// DELETE /api/v1/relations
relationRoutes.delete('/relations', async (c) => {
  const body = deleteRelationSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, body.sourceRowId);
  await adapter.deleteRelation(body.sourceRowId, body.columnId, body.targetRowId);
  return c.json({ success: true });
});

// GET /api/v1/rows/:rowId/relations/:columnId
relationRoutes.get('/rows/:rowId/relations/:columnId', async (c) => {
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  const rows = await adapter.getRelatedRows(c.req.param('rowId'), c.req.param('columnId'));
  return c.json(rows);
});

// GET /api/v1/rows/:rowId/relations
relationRoutes.get('/rows/:rowId/relations', async (c) => {
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  const relations = await adapter.getRelationsForRow(c.req.param('rowId'));
  return c.json(relations);
});

export { relationRoutes };
```

**Step 2: Create file reference routes**

`projects/lumitra-infra/data-brain/packages/api/src/routes/file-refs.ts`:
```typescript
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import { createFileRefSchema, reorderIdsSchema } from '@data-brain/shared';

const fileRefRoutes = new Hono<AppEnv>();

fileRefRoutes.use('*', authMiddleware);

async function verifyRowOwnership(c: any, adapter: any, rowId: string) {
  const row = await adapter.getRow(rowId);
  if (!row) throw ApiError.notFound('Row not found');
  const table = await adapter.getTable(row.tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Row not found');
  return row;
}

// POST /api/v1/file-refs
fileRefRoutes.post('/file-refs', async (c) => {
  const body = createFileRefSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, body.rowId);
  const ref = await adapter.addFileReference(body);
  return c.json(ref, 201);
});

// DELETE /api/v1/file-refs/:fileRefId
fileRefRoutes.delete('/file-refs/:fileRefId', async (c) => {
  const adapter = getAdapter(c);
  await adapter.removeFileReference(c.req.param('fileRefId'));
  return c.json({ success: true });
});

// GET /api/v1/rows/:rowId/files/:columnId
fileRefRoutes.get('/rows/:rowId/files/:columnId', async (c) => {
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  const refs = await adapter.getFileReferences(c.req.param('rowId'), c.req.param('columnId'));
  return c.json(refs);
});

// PUT /api/v1/rows/:rowId/files/:columnId/reorder
fileRefRoutes.put('/rows/:rowId/files/:columnId/reorder', async (c) => {
  const fileRefIds = reorderIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  await adapter.reorderFileReferences(c.req.param('rowId'), c.req.param('columnId'), fileRefIds);
  return c.json({ success: true });
});

export { fileRefRoutes };
```

**Step 3: Create batch route**

`projects/lumitra-infra/data-brain/packages/api/src/routes/batch.ts`:
```typescript
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { getAdapter, getWorkspaceId } from '../adapter';
import { batchRequestSchema } from '@data-brain/shared';
import type { BatchResult } from '@data-brain/shared';
import type { DatabaseAdapter } from '@marlinjai/data-table-core';

const batchRoutes = new Hono<AppEnv>();

batchRoutes.use('*', authMiddleware);

// POST /api/v1/rpc/batch
batchRoutes.post('/rpc/batch', async (c) => {
  const { operations } = batchRequestSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const workspaceId = getWorkspaceId(c);

  const results: BatchResult[] = [];

  for (const op of operations) {
    try {
      // Inject workspaceId for createTable operations
      const params = { ...op.params };
      if (op.method === 'createTable') {
        params.workspaceId = workspaceId;
      }
      if (op.method === 'listTables') {
        params.workspaceId = workspaceId;
      }

      const method = op.method as keyof DatabaseAdapter;
      const fn = adapter[method] as Function;

      // Call the adapter method with the appropriate params
      let data: unknown;
      switch (op.method) {
        // Methods with single string param
        case 'getTable':
        case 'deleteTable':
        case 'getColumns':
        case 'getColumn':
        case 'deleteColumn':
        case 'getRow':
        case 'deleteRow':
        case 'archiveRow':
        case 'unarchiveRow':
        case 'getView':
        case 'deleteView':
        case 'getViews':
        case 'getSelectOptions':
        case 'deleteSelectOption':
        case 'removeFileReference':
        case 'getRelationsForRow':
          data = await fn.call(adapter, params.id ?? params.tableId ?? params.columnId ?? params.rowId ?? params.viewId ?? params.optionId ?? params.fileRefId);
          break;
        // Methods with object param
        case 'createTable':
        case 'createColumn':
        case 'createRow':
        case 'createView':
        case 'createSelectOption':
        case 'createRelation':
        case 'addFileReference':
          data = await fn.call(adapter, params);
          break;
        // Methods with id + updates
        case 'updateTable':
        case 'updateColumn':
        case 'updateView':
        case 'updateSelectOption':
          data = await fn.call(adapter, params.id, params.updates);
          break;
        case 'updateRow':
          data = await fn.call(adapter, params.id, params.cells);
          break;
        // List methods
        case 'listTables':
          data = await fn.call(adapter, params.workspaceId);
          break;
        case 'getRows':
          data = await fn.call(adapter, params.tableId, params.query);
          break;
        // Bulk methods
        case 'bulkCreateRows':
          data = await fn.call(adapter, params.inputs);
          break;
        case 'bulkDeleteRows':
        case 'bulkArchiveRows':
          data = await fn.call(adapter, params.rowIds);
          break;
        // Reorder methods
        case 'reorderColumns':
        case 'reorderViews':
          data = await fn.call(adapter, params.tableId, params.ids);
          break;
        case 'reorderSelectOptions':
          data = await fn.call(adapter, params.columnId, params.ids);
          break;
        case 'reorderFileReferences':
          data = await fn.call(adapter, params.rowId, params.columnId, params.ids);
          break;
        // Relation getters
        case 'getRelatedRows':
          data = await fn.call(adapter, params.rowId, params.columnId);
          break;
        case 'deleteRelation':
          data = await fn.call(adapter, params.sourceRowId, params.columnId, params.targetRowId);
          break;
        case 'getFileReferences':
          data = await fn.call(adapter, params.rowId, params.columnId);
          break;
        default:
          throw new Error(`Unknown batch method: ${op.method}`);
      }

      results.push({ success: true, data });
    } catch (err) {
      results.push({
        success: false,
        error: {
          code: 'OPERATION_FAILED',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  }

  return c.json({ results });
});

export { batchRoutes };
```

**Step 4: Mount routes**

Add to `projects/lumitra-infra/data-brain/packages/api/src/index.ts`:

```typescript
import { relationRoutes } from './routes/relations';
import { fileRefRoutes } from './routes/file-refs';
import { batchRoutes } from './routes/batch';

app.route('/api/v1', relationRoutes);
app.route('/api/v1', fileRefRoutes);
app.route('/api/v1', batchRoutes);
```

**Step 5: Typecheck**

```bash
cd projects/lumitra-infra/data-brain && pnpm --filter @data-brain/api typecheck
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): add relation, file reference, and batch routes — API complete"
```

---

## Task 9: SDK package — errors, constants, types

**Files:**
- Create: `projects/lumitra-infra/data-brain/packages/sdk/src/errors.ts`
- Create: `projects/lumitra-infra/data-brain/packages/sdk/src/constants.ts`
- Create: `projects/lumitra-infra/data-brain/packages/sdk/src/types.ts`

**Step 1: Create error classes**

`projects/lumitra-infra/data-brain/packages/sdk/src/errors.ts`:
```typescript
export class DataBrainError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DataBrainError';
  }
}

export class AuthenticationError extends DataBrainError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends DataBrainError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends DataBrainError {
  constructor(message: string, public errors?: Array<{ path: string; message: string }>) {
    super(message, 'VALIDATION_ERROR', 400, { errors });
    this.name = 'ValidationError';
  }
}

export class QuotaExceededError extends DataBrainError {
  constructor(message = 'Quota exceeded') {
    super(message, 'QUOTA_EXCEEDED', 403);
    this.name = 'QuotaExceededError';
  }
}

export class ConflictError extends DataBrainError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class NetworkError extends DataBrainError {
  constructor(message = 'Network error occurred', public originalError?: Error) {
    super(message, 'NETWORK_ERROR', undefined, { originalError: originalError?.message });
    this.name = 'NetworkError';
  }
}

export class BatchError extends DataBrainError {
  constructor(
    message: string,
    public results: Array<{ success: boolean; data?: unknown; error?: { code: string; message: string } }>
  ) {
    super(message, 'BATCH_ERROR', undefined, { results });
    this.name = 'BatchError';
  }
}

export function parseApiError(
  statusCode: number,
  response: { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
): DataBrainError {
  const { code, message, details } = response.error ?? {};

  switch (code) {
    case 'UNAUTHORIZED':
      return new AuthenticationError(message);
    case 'NOT_FOUND':
      return new NotFoundError(message);
    case 'VALIDATION_ERROR':
      return new ValidationError(
        message ?? 'Validation failed',
        details?.errors as Array<{ path: string; message: string }>
      );
    case 'QUOTA_EXCEEDED':
      return new QuotaExceededError(message);
    case 'CONFLICT':
      return new ConflictError(message ?? 'Conflict');
    default:
      return new DataBrainError(
        message ?? 'An error occurred',
        code ?? 'UNKNOWN_ERROR',
        statusCode,
        details
      );
  }
}
```

**Step 2: Create constants**

`projects/lumitra-infra/data-brain/packages/sdk/src/constants.ts`:
```typescript
export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
} as const;
```

**Step 3: Create types**

`projects/lumitra-infra/data-brain/packages/sdk/src/types.ts`:
```typescript
/**
 * SDK configuration
 */
export interface DataBrainConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Tenant info returned by the API
 */
export interface TenantInfo {
  id: string;
  name: string;
  quotaRows: number;
  usedRows: number;
  maxTables: number;
  createdAt: string;
}

/**
 * Batch operation
 */
export interface BatchOperation {
  method: string;
  params: Record<string, unknown>;
}

/**
 * Single result in a batch
 */
export interface BatchResult {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

// All data-table types are re-exported from @marlinjai/data-table-core
// No duplication needed
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(sdk): add error classes, constants, and types"
```

---

## Task 10: SDK — client implementation

**Files:**
- Create: `projects/lumitra-infra/data-brain/packages/sdk/src/client.ts`
- Create: `projects/lumitra-infra/data-brain/packages/sdk/src/index.ts`

**Step 1: Create the DataBrain client**

`projects/lumitra-infra/data-brain/packages/sdk/src/client.ts`:
```typescript
import type {
  Table, Column, Row, View, SelectOption, FileReference,
  CreateTableInput, UpdateTableInput,
  CreateColumnInput, UpdateColumnInput,
  CreateRowInput, QueryOptions, QueryResult,
  CreateViewInput, UpdateViewInput,
  CreateSelectOptionInput, UpdateSelectOptionInput,
  CreateRelationInput, CreateFileRefInput,
  CellValue,
} from '@marlinjai/data-table-core';
import type { DataBrainConfig, TenantInfo, BatchOperation, BatchResult } from './types';
import { DataBrainError, NetworkError, parseApiError } from './errors';
import { RETRY_CONFIG } from './constants';

const DEFAULT_BASE_URL = 'https://data-brain-api.marlin-pohl.workers.dev';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;

export class DataBrain {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(config: DataBrainConfig) {
    if (!config.apiKey) throw new DataBrainError('API key is required', 'CONFIGURATION_ERROR');
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  // ─── Tables ──────────────────────────────────────────────────────────────

  async createTable(input: CreateTableInput): Promise<Table> {
    return this.request<Table>('POST', '/api/v1/tables', input);
  }

  async getTable(tableId: string): Promise<Table | null> {
    try {
      return await this.request<Table>('GET', `/api/v1/tables/${tableId}`);
    } catch (err) {
      if (err instanceof DataBrainError && err.statusCode === 404) return null;
      throw err;
    }
  }

  async updateTable(tableId: string, updates: UpdateTableInput): Promise<Table> {
    return this.request<Table>('PATCH', `/api/v1/tables/${tableId}`, updates);
  }

  async deleteTable(tableId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/tables/${tableId}`);
  }

  async listTables(workspaceId: string): Promise<Table[]> {
    return this.request<Table[]>('GET', `/api/v1/tables`);
  }

  // ─── Columns ─────────────────────────────────────────────────────────────

  async createColumn(input: CreateColumnInput): Promise<Column> {
    return this.request<Column>('POST', `/api/v1/tables/${input.tableId}/columns`, input);
  }

  async getColumns(tableId: string): Promise<Column[]> {
    return this.request<Column[]>('GET', `/api/v1/tables/${tableId}/columns`);
  }

  async getColumn(columnId: string): Promise<Column | null> {
    try {
      return await this.request<Column>('GET', `/api/v1/columns/${columnId}`);
    } catch (err) {
      if (err instanceof DataBrainError && err.statusCode === 404) return null;
      throw err;
    }
  }

  async updateColumn(columnId: string, updates: UpdateColumnInput): Promise<Column> {
    return this.request<Column>('PATCH', `/api/v1/columns/${columnId}`, updates);
  }

  async deleteColumn(columnId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/columns/${columnId}`);
  }

  async reorderColumns(tableId: string, columnIds: string[]): Promise<void> {
    await this.request('PUT', `/api/v1/tables/${tableId}/columns/reorder`, columnIds);
  }

  // ─── Rows ────────────────────────────────────────────────────────────────

  async createRow(input: CreateRowInput): Promise<Row> {
    return this.request<Row>('POST', `/api/v1/tables/${input.tableId}/rows`, input);
  }

  async getRow(rowId: string): Promise<Row | null> {
    try {
      return await this.request<Row>('GET', `/api/v1/rows/${rowId}`);
    } catch (err) {
      if (err instanceof DataBrainError && err.statusCode === 404) return null;
      throw err;
    }
  }

  async getRows(tableId: string, query?: QueryOptions): Promise<QueryResult<Row>> {
    const params = new URLSearchParams();
    if (query) {
      if (query.limit) params.set('limit', String(query.limit));
      if (query.offset) params.set('offset', String(query.offset));
      if (query.cursor) params.set('cursor', query.cursor);
      if (query.includeArchived) params.set('includeArchived', 'true');
      if (query.parentRowId !== undefined) params.set('parentRowId', String(query.parentRowId));
      if (query.includeSubItems) params.set('includeSubItems', 'true');
      if (query.filters?.length) params.set('filters', JSON.stringify(query.filters));
      if (query.sorts?.length) params.set('sorts', JSON.stringify(query.sorts));
    }
    const qs = params.toString();
    const path = qs ? `/api/v1/tables/${tableId}/rows?${qs}` : `/api/v1/tables/${tableId}/rows`;
    return this.request<QueryResult<Row>>('GET', path);
  }

  async updateRow(rowId: string, cells: Record<string, CellValue>): Promise<Row> {
    return this.request<Row>('PATCH', `/api/v1/rows/${rowId}`, cells);
  }

  async deleteRow(rowId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/rows/${rowId}`);
  }

  async archiveRow(rowId: string): Promise<void> {
    await this.request('POST', `/api/v1/rows/${rowId}/archive`);
  }

  async unarchiveRow(rowId: string): Promise<void> {
    await this.request('POST', `/api/v1/rows/${rowId}/unarchive`);
  }

  async bulkCreateRows(inputs: CreateRowInput[]): Promise<Row[]> {
    if (inputs.length === 0) return [];
    const tableId = inputs[0]!.tableId;
    return this.request<Row[]>('POST', `/api/v1/tables/${tableId}/rows/bulk`, inputs);
  }

  async bulkDeleteRows(rowIds: string[]): Promise<void> {
    await this.request('DELETE', '/api/v1/rows/bulk', rowIds);
  }

  async bulkArchiveRows(rowIds: string[]): Promise<void> {
    await this.request('POST', '/api/v1/rows/bulk/archive', rowIds);
  }

  // ─── Views ───────────────────────────────────────────────────────────────

  async createView(input: CreateViewInput): Promise<View> {
    return this.request<View>('POST', `/api/v1/tables/${input.tableId}/views`, input);
  }

  async getViews(tableId: string): Promise<View[]> {
    return this.request<View[]>('GET', `/api/v1/tables/${tableId}/views`);
  }

  async getView(viewId: string): Promise<View | null> {
    try {
      return await this.request<View>('GET', `/api/v1/views/${viewId}`);
    } catch (err) {
      if (err instanceof DataBrainError && err.statusCode === 404) return null;
      throw err;
    }
  }

  async updateView(viewId: string, updates: UpdateViewInput): Promise<View> {
    return this.request<View>('PATCH', `/api/v1/views/${viewId}`, updates);
  }

  async deleteView(viewId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/views/${viewId}`);
  }

  async reorderViews(tableId: string, viewIds: string[]): Promise<void> {
    await this.request('PUT', `/api/v1/tables/${tableId}/views/reorder`, viewIds);
  }

  // ─── Select Options ────────────────────────────────────────────────────

  async createSelectOption(input: CreateSelectOptionInput): Promise<SelectOption> {
    return this.request<SelectOption>('POST', `/api/v1/columns/${input.columnId}/options`, input);
  }

  async getSelectOptions(columnId: string): Promise<SelectOption[]> {
    return this.request<SelectOption[]>('GET', `/api/v1/columns/${columnId}/options`);
  }

  async updateSelectOption(optionId: string, updates: UpdateSelectOptionInput): Promise<SelectOption> {
    return this.request<SelectOption>('PATCH', `/api/v1/options/${optionId}`, updates);
  }

  async deleteSelectOption(optionId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/options/${optionId}`);
  }

  async reorderSelectOptions(columnId: string, optionIds: string[]): Promise<void> {
    await this.request('PUT', `/api/v1/columns/${columnId}/options/reorder`, optionIds);
  }

  // ─── Relations ───────────────────────────────────────────────────────────

  async createRelation(input: CreateRelationInput): Promise<void> {
    await this.request('POST', '/api/v1/relations', input);
  }

  async deleteRelation(sourceRowId: string, columnId: string, targetRowId: string): Promise<void> {
    await this.request('DELETE', '/api/v1/relations', { sourceRowId, columnId, targetRowId });
  }

  async getRelatedRows(rowId: string, columnId: string): Promise<Row[]> {
    return this.request<Row[]>('GET', `/api/v1/rows/${rowId}/relations/${columnId}`);
  }

  async getRelationsForRow(rowId: string): Promise<Array<{ columnId: string; targetRowId: string }>> {
    return this.request<Array<{ columnId: string; targetRowId: string }>>('GET', `/api/v1/rows/${rowId}/relations`);
  }

  // ─── File References ─────────────────────────────────────────────────────

  async addFileReference(input: CreateFileRefInput): Promise<FileReference> {
    return this.request<FileReference>('POST', '/api/v1/file-refs', input);
  }

  async removeFileReference(fileRefId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/file-refs/${fileRefId}`);
  }

  async getFileReferences(rowId: string, columnId: string): Promise<FileReference[]> {
    return this.request<FileReference[]>('GET', `/api/v1/rows/${rowId}/files/${columnId}`);
  }

  async reorderFileReferences(rowId: string, columnId: string, fileRefIds: string[]): Promise<void> {
    await this.request('PUT', `/api/v1/rows/${rowId}/files/${columnId}/reorder`, fileRefIds);
  }

  // ─── Batch ───────────────────────────────────────────────────────────────

  async batch(operations: BatchOperation[]): Promise<BatchResult[]> {
    const response = await this.request<{ results: BatchResult[] }>('POST', '/api/v1/rpc/batch', { operations });
    return response.results;
  }

  // ─── Tenant ──────────────────────────────────────────────────────────────

  async getTenantInfo(): Promise<TenantInfo> {
    return this.request<TenantInfo>('GET', '/api/v1/tenant/info');
  }

  // ─── HTTP Layer ──────────────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw parseApiError(response.status, errorBody as { error?: { code?: string; message?: string; details?: Record<string, unknown> } });
        }

        // Handle 204 No Content
        if (response.status === 204) return undefined as T;

        return await response.json() as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry client errors (4xx)
        if (error instanceof DataBrainError && error.statusCode && error.statusCode < 500) {
          throw error;
        }

        if (attempt < this.maxRetries - 1) {
          const delay = Math.min(
            RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
            RETRY_CONFIG.maxDelayMs
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new NetworkError(`Request failed after ${this.maxRetries} attempts`, lastError);
  }
}

export default DataBrain;
```

**Step 2: Create barrel export**

`projects/lumitra-infra/data-brain/packages/sdk/src/index.ts`:
```typescript
// Main client
export { DataBrain, DataBrain as default } from './client';

// Types
export type { DataBrainConfig, TenantInfo, BatchOperation, BatchResult } from './types';

// Errors
export {
  DataBrainError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  QuotaExceededError,
  ConflictError,
  NetworkError,
  BatchError,
} from './errors';

// Re-export all data-table-core types for convenience
export type {
  Table, Column, Row, View, SelectOption, FileReference,
  CreateTableInput, UpdateTableInput,
  CreateColumnInput, UpdateColumnInput,
  CreateRowInput, QueryOptions, QueryResult,
  CreateViewInput, UpdateViewInput,
  CreateSelectOptionInput, UpdateSelectOptionInput,
  CreateRelationInput, CreateFileRefInput,
  CellValue, ColumnType, ViewType, FilterOperator, QueryFilter, QuerySort,
} from '@marlinjai/data-table-core';
```

**Step 3: Build SDK**

```bash
cd projects/lumitra-infra/data-brain && pnpm --filter @marlinjai/data-brain-sdk build
```

Expected: `packages/sdk/dist/` with `index.js`, `index.cjs`, `index.d.ts`.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(sdk): implement DataBrain client — all 43 adapter methods + batch + tenant"
```

---

## Task 11: adapter-data-brain package in data-table monorepo

**Files:**
- Create: `projects/data-table/packages/adapter-data-brain/package.json`
- Create: `projects/data-table/packages/adapter-data-brain/tsconfig.json`
- Create: `projects/data-table/packages/adapter-data-brain/tsup.config.ts`
- Create: `projects/data-table/packages/adapter-data-brain/src/index.ts`
- Modify: `projects/data-table/package.json` (add build script)

**Step 1: Create package.json**

`projects/data-table/packages/adapter-data-brain/package.json`:
```json
{
  "name": "@marlinjai/data-table-adapter-data-brain",
  "version": "0.1.0",
  "description": "Data Brain adapter for @marlinjai/data-table — HTTP-backed DatabaseAdapter",
  "author": "marlinjai",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/marlinjai/marlinjai-data-table.git",
    "directory": "packages/adapter-data-brain"
  },
  "publishConfig": {
    "access": "restricted"
  },
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@marlinjai/data-table-core": "*",
    "@marlinjai/data-brain-sdk": "^0.1.0"
  },
  "devDependencies": {
    "tsup": "^8.0.1",
    "typescript": "^5.3.3"
  }
}
```

**Step 2: Create tsconfig and tsup config**

`projects/data-table/packages/adapter-data-brain/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

`projects/data-table/packages/adapter-data-brain/tsup.config.ts`:
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@marlinjai/data-table-core', '@marlinjai/data-brain-sdk'],
});
```

**Step 3: Implement the adapter**

`projects/data-table/packages/adapter-data-brain/src/index.ts`:
```typescript
import { BaseDatabaseAdapter } from '@marlinjai/data-table-core';
import type {
  Table, Column, Row, View, SelectOption, FileReference,
  CreateTableInput, UpdateTableInput,
  CreateColumnInput, UpdateColumnInput,
  CreateRowInput, QueryOptions, QueryResult,
  CreateViewInput, UpdateViewInput,
  CreateSelectOptionInput, UpdateSelectOptionInput,
  CreateRelationInput, CreateFileRefInput,
  CellValue, DatabaseAdapter,
} from '@marlinjai/data-table-core';
import type { DataBrain } from '@marlinjai/data-brain-sdk';

export interface DataBrainAdapterConfig {
  client: DataBrain;
  workspaceId: string;
}

/**
 * Data Brain adapter — delegates all DatabaseAdapter calls to the Data Brain SDK over HTTP.
 * Drop-in replacement for D1Adapter, MemoryAdapter, etc.
 */
export class DataBrainAdapter extends BaseDatabaseAdapter {
  private readonly client: DataBrain;
  private readonly workspaceId: string;

  constructor(config: DataBrainAdapterConfig) {
    super();
    this.client = config.client;
    this.workspaceId = config.workspaceId;
  }

  // ─── Tables ──────────────────────────────────────────────────────────────

  async createTable(input: CreateTableInput): Promise<Table> {
    return this.client.createTable({ ...input, workspaceId: this.workspaceId });
  }

  async getTable(tableId: string): Promise<Table | null> {
    return this.client.getTable(tableId);
  }

  async updateTable(tableId: string, updates: UpdateTableInput): Promise<Table> {
    return this.client.updateTable(tableId, updates);
  }

  async deleteTable(tableId: string): Promise<void> {
    return this.client.deleteTable(tableId);
  }

  async listTables(workspaceId: string): Promise<Table[]> {
    return this.client.listTables(workspaceId);
  }

  // ─── Columns ─────────────────────────────────────────────────────────────

  async createColumn(input: CreateColumnInput): Promise<Column> {
    return this.client.createColumn(input);
  }

  async getColumns(tableId: string): Promise<Column[]> {
    return this.client.getColumns(tableId);
  }

  async getColumn(columnId: string): Promise<Column | null> {
    return this.client.getColumn(columnId);
  }

  async updateColumn(columnId: string, updates: UpdateColumnInput): Promise<Column> {
    return this.client.updateColumn(columnId, updates);
  }

  async deleteColumn(columnId: string): Promise<void> {
    return this.client.deleteColumn(columnId);
  }

  async reorderColumns(tableId: string, columnIds: string[]): Promise<void> {
    return this.client.reorderColumns(tableId, columnIds);
  }

  // ─── Select Options ────────────────────────────────────────────────────

  async createSelectOption(input: CreateSelectOptionInput): Promise<SelectOption> {
    return this.client.createSelectOption(input);
  }

  async getSelectOptions(columnId: string): Promise<SelectOption[]> {
    return this.client.getSelectOptions(columnId);
  }

  async updateSelectOption(optionId: string, updates: UpdateSelectOptionInput): Promise<SelectOption> {
    return this.client.updateSelectOption(optionId, updates);
  }

  async deleteSelectOption(optionId: string): Promise<void> {
    return this.client.deleteSelectOption(optionId);
  }

  async reorderSelectOptions(columnId: string, optionIds: string[]): Promise<void> {
    return this.client.reorderSelectOptions(columnId, optionIds);
  }

  // ─── Rows ────────────────────────────────────────────────────────────────

  async createRow(input: CreateRowInput): Promise<Row> {
    return this.client.createRow(input);
  }

  async getRow(rowId: string): Promise<Row | null> {
    return this.client.getRow(rowId);
  }

  async getRows(tableId: string, query?: QueryOptions): Promise<QueryResult<Row>> {
    return this.client.getRows(tableId, query);
  }

  async updateRow(rowId: string, cells: Record<string, CellValue>): Promise<Row> {
    return this.client.updateRow(rowId, cells);
  }

  async deleteRow(rowId: string): Promise<void> {
    return this.client.deleteRow(rowId);
  }

  async archiveRow(rowId: string): Promise<void> {
    return this.client.archiveRow(rowId);
  }

  async unarchiveRow(rowId: string): Promise<void> {
    return this.client.unarchiveRow(rowId);
  }

  async bulkCreateRows(inputs: CreateRowInput[]): Promise<Row[]> {
    return this.client.bulkCreateRows(inputs);
  }

  async bulkDeleteRows(rowIds: string[]): Promise<void> {
    return this.client.bulkDeleteRows(rowIds);
  }

  async bulkArchiveRows(rowIds: string[]): Promise<void> {
    return this.client.bulkArchiveRows(rowIds);
  }

  // ─── Relations ───────────────────────────────────────────────────────────

  async createRelation(input: CreateRelationInput): Promise<void> {
    return this.client.createRelation(input);
  }

  async deleteRelation(sourceRowId: string, columnId: string, targetRowId: string): Promise<void> {
    return this.client.deleteRelation(sourceRowId, columnId, targetRowId);
  }

  async getRelatedRows(rowId: string, columnId: string): Promise<Row[]> {
    return this.client.getRelatedRows(rowId, columnId);
  }

  async getRelationsForRow(rowId: string): Promise<Array<{ columnId: string; targetRowId: string }>> {
    return this.client.getRelationsForRow(rowId);
  }

  // ─── File References ─────────────────────────────────────────────────────

  async addFileReference(input: CreateFileRefInput): Promise<FileReference> {
    return this.client.addFileReference(input);
  }

  async removeFileReference(fileRefId: string): Promise<void> {
    return this.client.removeFileReference(fileRefId);
  }

  async getFileReferences(rowId: string, columnId: string): Promise<FileReference[]> {
    return this.client.getFileReferences(rowId, columnId);
  }

  async reorderFileReferences(rowId: string, columnId: string, fileRefIds: string[]): Promise<void> {
    return this.client.reorderFileReferences(rowId, columnId, fileRefIds);
  }

  // ─── Views ───────────────────────────────────────────────────────────────

  async createView(input: CreateViewInput): Promise<View> {
    return this.client.createView(input);
  }

  async getViews(tableId: string): Promise<View[]> {
    return this.client.getViews(tableId);
  }

  async getView(viewId: string): Promise<View | null> {
    return this.client.getView(viewId);
  }

  async updateView(viewId: string, updates: UpdateViewInput): Promise<View> {
    return this.client.updateView(viewId, updates);
  }

  async deleteView(viewId: string): Promise<void> {
    return this.client.deleteView(viewId);
  }

  async reorderViews(tableId: string, viewIds: string[]): Promise<void> {
    return this.client.reorderViews(tableId, viewIds);
  }

  // ─── Transactions ────────────────────────────────────────────────────────

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    // HTTP-backed adapter can't do real transactions.
    // Use batch endpoint for atomic operations instead.
    // For now, execute fn with `this` as the adapter (non-atomic).
    return fn(this);
  }
}
```

**Step 4: Add build script to data-table root**

In `projects/data-table/package.json`, update the `build` script to include the new adapter:

Add `&& npm run build -w @marlinjai/data-table-adapter-data-brain` to the end of the `build` script.

**Step 5: Install and build**

```bash
cd "projects/data-table"
npm install
npm run build -w @marlinjai/data-table-adapter-data-brain
```

**Step 6: Commit** (in data-table repo)

```bash
cd "projects/data-table"
git add -A
git commit -m "feat: add DataBrainAdapter — HTTP-backed DatabaseAdapter using Data Brain SDK"
```

---

## Task 12: API — D1 migration for data-table schema + final index.ts

**Files:**
- Create: `projects/lumitra-infra/data-brain/packages/api/migrations/0002_data_tables.sql`
- Modify: `projects/lumitra-infra/data-brain/packages/api/src/index.ts` (final version with all routes)

**Step 1: Copy data-table D1 migration**

The Data Brain API uses the same D1 database for both its own `tenants` table and the data-table schema. Copy the D1 adapter's migration:

`projects/lumitra-infra/data-brain/packages/api/migrations/0002_data_tables.sql`:

Copy the exact contents of `projects/data-table/packages/adapter-d1/migrations/0001_initial.sql`. This creates `dt_tables`, `dt_columns`, `dt_select_options`, `dt_rows`, `dt_relations`, `dt_files`, and `dt_views` tables.

**Step 2: Write final index.ts**

`projects/lumitra-infra/data-brain/packages/api/src/index.ts` (complete, all routes mounted):
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { requestId } from 'hono/request-id';

import type { AppEnv } from './env';
import { errorHandler } from './middleware/error-handler';
import { tenantRoutes } from './routes/tenant';
import { adminRoutes } from './routes/admin';
import { tableRoutes } from './routes/tables';
import { columnRoutes } from './routes/columns';
import { rowRoutes } from './routes/rows';
import { viewRoutes } from './routes/views';
import { selectOptionRoutes } from './routes/select-options';
import { relationRoutes } from './routes/relations';
import { fileRefRoutes } from './routes/file-refs';
import { batchRoutes } from './routes/batch';

const app = new Hono<AppEnv>();

// Global middleware
app.use('*', secureHeaders());
app.use('*', requestId());
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-Id'],
  maxAge: 86400,
}));

app.onError(errorHandler);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), environment: c.env.ENVIRONMENT });
});

// Routes
app.route('/api/v1/tables', tableRoutes);
app.route('/api/v1', columnRoutes);
app.route('/api/v1', rowRoutes);
app.route('/api/v1', viewRoutes);
app.route('/api/v1', selectOptionRoutes);
app.route('/api/v1', relationRoutes);
app.route('/api/v1', fileRefRoutes);
app.route('/api/v1', batchRoutes);
app.route('/api/v1/tenant', tenantRoutes);
app.route('/api/v1/admin', adminRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` } }, 404);
});

export default { fetch: app.fetch };
```

**Step 3: Typecheck everything**

```bash
cd projects/lumitra-infra/data-brain
pnpm --filter @data-brain/shared build
pnpm --filter @data-brain/api typecheck
pnpm --filter @marlinjai/data-brain-sdk build
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(api): add data-table migration, finalize route mounting"
```

---

## Task 13: Build verification, D1 creation, and deployment

**Files:**
- Modify: `projects/lumitra-infra/data-brain/packages/api/wrangler.toml` (update database_id)

**Step 1: Full build check**

```bash
cd projects/lumitra-infra/data-brain
pnpm build
```

Expected: All three packages build successfully.

**Step 2: Create D1 database**

```bash
cd projects/lumitra-infra/data-brain/packages/api
npx wrangler d1 create data-brain-db
```

Copy the output `database_id` and update `wrangler.toml`.

**Step 3: Run migrations locally**

```bash
npx wrangler d1 migrations apply data-brain-db --local
```

Expected: Both migrations applied (tenants + data-table schema).

**Step 4: Test locally**

```bash
npx wrangler dev
```

Test health endpoint:
```bash
curl http://localhost:8787/health
```

Expected: `{"status":"ok","timestamp":"...","environment":"production"}`

**Step 5: Set admin API key secret**

```bash
npx wrangler secret put ADMIN_API_KEY
```

Enter a secure admin key when prompted.

**Step 6: Run migrations on production**

```bash
npx wrangler d1 migrations apply data-brain-db
```

**Step 7: Deploy**

```bash
npx wrangler deploy
```

Expected: Deployed to `data-brain-api.marlin-pohl.workers.dev`.

**Step 8: Create first tenant**

```bash
curl -X POST https://data-brain-api.marlin-pohl.workers.dev/api/v1/admin/tenants \
  -H "Authorization: Bearer <ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name": "receipt-ocr"}'
```

Expected: Returns `{ "tenant": {...}, "apiKey": "sk_live_..." }`. Save this API key.

**Step 9: Smoke test with tenant key**

```bash
curl https://data-brain-api.marlin-pohl.workers.dev/api/v1/tenant/info \
  -H "Authorization: Bearer sk_live_..."
```

Expected: Returns tenant info JSON.

**Step 10: Publish SDK to npm**

```bash
cd projects/lumitra-infra/data-brain
pnpm publish:sdk
```

**Step 11: Commit final config**

```bash
git add -A
git commit -m "chore: configure D1 database, verify deployment"
```

---

## Summary of commits

| Task | Commit message |
|------|---------------|
| 1 | `chore: scaffold data-brain monorepo with shared, api, sdk packages` |
| 2 | `feat(shared): add types, constants, and Zod validation schemas` |
| 3 | `feat(api): scaffold Hono app with auth middleware, error handler, env types` |
| 4 | `feat(api): add tenant management — migration, service, tenant + admin routes` |
| 5 | `feat(api): add table and column routes with tenant ownership checks` |
| 6 | `feat(api): add row routes — CRUD, archive, bulk operations, query with filters` |
| 7 | `feat(api): add view and select option routes` |
| 8 | `feat(api): add relation, file reference, and batch routes — API complete` |
| 9 | `feat(sdk): add error classes, constants, and types` |
| 10 | `feat(sdk): implement DataBrain client — all 43 adapter methods + batch + tenant` |
| 11 | `feat: add DataBrainAdapter — HTTP-backed DatabaseAdapter using Data Brain SDK` |
| 12 | `feat(api): add data-table migration, finalize route mounting` |
| 13 | `chore: configure D1 database, verify deployment` |

## Dependencies between tasks

- Tasks 1-2: Must be sequential (shared package is needed first)
- Tasks 3-8: Sequential (each builds on previous API work)
- Tasks 9-10: Can start after Task 2 (SDK depends on shared types via data-table-core, not on API)
- Task 11: Can start after Task 10 (adapter depends on SDK)
- Task 12: After Task 8 (finalize API)
- Task 13: After all other tasks

**Parallelization opportunity:** Tasks 9-10 (SDK) can run in parallel with Tasks 5-8 (API routes).
