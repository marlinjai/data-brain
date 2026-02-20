import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { requestId } from 'hono/request-id';

import type { AppEnv } from './env';
import { errorHandler } from './middleware/error-handler';
import { tenantRoutes } from './routes/tenant';
import { adminRoutes } from './routes/admin';

const app = new Hono<AppEnv>();

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

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), environment: c.env.ENVIRONMENT });
});

// Routes
app.route('/api/v1/tenant', tenantRoutes);
app.route('/api/v1/admin', adminRoutes);

app.notFound((c) => {
  return c.json({ error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` } }, 404);
});

export default { fetch: app.fetch };
