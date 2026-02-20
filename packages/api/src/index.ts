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
// SECURITY: Batch endpoint disabled until proper per-operation tenant ownership
// checks are implemented. The batch RPC bypasses tenant isolation because it
// calls adapter methods directly without verifying resource ownership for each
// operation. See issue I3 in the security review.
// import { batchRoutes } from './routes/batch';

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

// Admin & tenant routes first (own auth middleware, must not be intercepted by tenant auth)
app.route('/api/v1/admin', adminRoutes);
app.route('/api/v1/tenant', tenantRoutes);

// Data routes (all use tenant authMiddleware)
app.route('/api/v1/tables', tableRoutes);
app.route('/api/v1', columnRoutes);
app.route('/api/v1', rowRoutes);
app.route('/api/v1', viewRoutes);
app.route('/api/v1', selectOptionRoutes);
app.route('/api/v1', relationRoutes);
app.route('/api/v1', fileRefRoutes);
// SECURITY: Batch endpoint disabled — see import comment above (I3)
// app.route('/api/v1', batchRoutes);

app.notFound((c) => {
  return c.json({ error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` } }, 404);
});

export default { fetch: app.fetch };
