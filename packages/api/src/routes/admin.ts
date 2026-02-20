import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { adminAuthMiddleware } from '../middleware/auth';
import { createTenant } from '../services/tenant';
import { createTenantSchema } from '@data-brain/shared';

const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', adminAuthMiddleware);

adminRoutes.post('/tenants', async (c) => {
  const body = createTenantSchema.parse(await c.req.json());
  const result = await createTenant(c.env.DB, body);
  return c.json(result, 201);
});

export { adminRoutes };
