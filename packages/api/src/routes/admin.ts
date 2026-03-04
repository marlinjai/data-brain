import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { adminAuthMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getTenantDb } from '../adapter';
import { toTenantInfo } from '../services/tenant';
import { createTenantSchema, updateTenantSchema, listTenantsQuerySchema } from '@data-brain/shared';

const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', adminAuthMiddleware);

// POST /api/v1/admin/tenants
adminRoutes.post('/tenants', async (c) => {
  const body = createTenantSchema.parse(await c.req.json());
  const tenantDb = getTenantDb(c);
  const result = await tenantDb.createTenant(body);
  return c.json(result, 201);
});

// GET /api/v1/admin/tenants
adminRoutes.get('/tenants', async (c) => {
  const tenantDb = getTenantDb(c);
  const query = listTenantsQuerySchema.parse({
    limit: c.req.query('limit'),
    cursor: c.req.query('cursor'),
  });

  const result = await tenantDb.listTenants(query);

  return c.json({
    tenants: result.tenants.map(toTenantInfo),
    nextCursor: result.nextCursor,
    total: result.total,
  });
});

// GET /api/v1/admin/tenants/:tenantId
adminRoutes.get('/tenants/:tenantId', async (c) => {
  const tenantDb = getTenantDb(c);
  const tenant = await tenantDb.getTenantById(c.req.param('tenantId'));

  if (!tenant) {
    throw ApiError.notFound('Tenant not found');
  }

  return c.json({
    ...toTenantInfo(tenant),
    quota: {
      quotaRows: tenant.quotaRows,
      usedRows: tenant.usedRows,
      availableRows: Math.max(0, tenant.quotaRows - tenant.usedRows),
      usagePercent: tenant.quotaRows > 0
        ? Math.round((tenant.usedRows / tenant.quotaRows) * 10000) / 100
        : 0,
    },
  });
});

// PATCH /api/v1/admin/tenants/:tenantId
adminRoutes.patch('/tenants/:tenantId', async (c) => {
  const updates = updateTenantSchema.parse(await c.req.json());
  const tenantDb = getTenantDb(c);
  const tenant = await tenantDb.updateTenant(c.req.param('tenantId'), updates);

  if (!tenant) {
    throw ApiError.notFound('Tenant not found');
  }

  return c.json(toTenantInfo(tenant));
});

// DELETE /api/v1/admin/tenants/:tenantId
adminRoutes.delete('/tenants/:tenantId', async (c) => {
  const tenantDb = getTenantDb(c);
  const deleted = await tenantDb.deleteTenant(c.req.param('tenantId'));

  if (!deleted) {
    throw ApiError.notFound('Tenant not found');
  }

  return c.json({ success: true });
});

// POST /api/v1/admin/tenants/:tenantId/regenerate-key
adminRoutes.post('/tenants/:tenantId/regenerate-key', async (c) => {
  const tenantDb = getTenantDb(c);
  const apiKey = await tenantDb.regenerateApiKey(c.req.param('tenantId'));

  if (!apiKey) {
    throw ApiError.notFound('Tenant not found');
  }

  return c.json({
    tenantId: c.req.param('tenantId'),
    apiKey,
    message: 'API key regenerated successfully. Store this key securely.',
  });
});

export { adminRoutes };
