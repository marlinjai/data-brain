import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { toTenantInfo } from '../services/tenant';

const tenantRoutes = new Hono<AppEnv>();

tenantRoutes.use('*', authMiddleware);

tenantRoutes.get('/info', (c) => {
  const tenant = c.get('tenant');
  return c.json(toTenantInfo(tenant));
});

export { tenantRoutes };
