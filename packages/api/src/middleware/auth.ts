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
    return c.get('tenantDb').getTenantByKeyHash(keyHash);
  },
});

/**
 * Admin authentication middleware — constant-time comparison against ADMIN_API_KEY
 */
export const adminAuthMiddleware = createAdminAuthMiddleware();

// Re-export hashApiKey for use in tenant service
export { hashApiKey };
