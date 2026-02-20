import { DEFAULT_QUOTA_ROWS, DEFAULT_MAX_TABLES, API_KEY_PREFIX_LIVE } from '@data-brain/shared';
import type { Tenant, TenantInfo } from '@data-brain/shared';
import { hashApiKey } from '../middleware/auth';

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
    apiKey,
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
