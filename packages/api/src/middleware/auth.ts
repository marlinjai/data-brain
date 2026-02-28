import { createAuthMiddleware, createAdminAuthMiddleware, hashApiKey } from '@marlinjai/brain-core';
import { apiKeySchema } from '@data-brain/shared';
import type { Tenant } from '@data-brain/shared';

/**
 * Authentication middleware — validates API key and attaches tenant context
 */
export const authMiddleware = createAuthMiddleware<Tenant>({
  apiKeySchema,
  lookupTenant: async (c, apiKey) => {
    const keyHash = await hashApiKey(apiKey);

    const row = await c.env.DB.prepare(
      'SELECT id, name, api_key_hash, quota_rows, used_rows, max_tables, created_at, updated_at FROM tenants WHERE api_key_hash = ?'
    ).bind(keyHash).first();

    if (!row) return null;

    return {
      id: row.id as string,
      name: row.name as string,
      apiKeyHash: row.api_key_hash as string,
      quotaRows: row.quota_rows as number,
      usedRows: row.used_rows as number,
      maxTables: row.max_tables as number,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  },
});

/**
 * Admin authentication middleware — constant-time comparison against ADMIN_API_KEY
 */
export const adminAuthMiddleware = createAdminAuthMiddleware();

// Re-export hashApiKey for use in tenant service
export { hashApiKey };
