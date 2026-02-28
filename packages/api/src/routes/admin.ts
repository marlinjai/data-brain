import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { adminAuthMiddleware } from '../middleware/auth';
import { getTenantDb } from '../adapter';
import { createTenantSchema } from '@data-brain/shared';

const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', adminAuthMiddleware);

adminRoutes.post('/tenants', async (c) => {
  const body = createTenantSchema.parse(await c.req.json());
  const tenantDb = getTenantDb(c);
  const result = await tenantDb.createTenant(body);
  return c.json(result, 201);
});

export { adminRoutes };
