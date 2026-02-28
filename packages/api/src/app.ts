import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { requestId } from 'hono/request-id';
import type { DatabaseAdapter } from '@marlinjai/data-table-core';

import type { AppEnv, Env } from './env';
import type { TenantDatabaseAdapter } from './tenant-adapter';
import { errorHandler } from './middleware/error-handler';
import { tenantRoutes } from './routes/tenant';
import { adminRoutes } from './routes/admin';
import { workspaceRoutes } from './routes/workspaces';
import { tableRoutes } from './routes/tables';
import { columnRoutes } from './routes/columns';
import { rowRoutes } from './routes/rows';
import { viewRoutes } from './routes/views';
import { selectOptionRoutes } from './routes/select-options';
import { relationRoutes } from './routes/relations';
import { fileRefRoutes } from './routes/file-refs';

export interface AppConfig {
  adapter: DatabaseAdapter;
  tenantDb: TenantDatabaseAdapter;
  /** Optional env overrides — used by Node.js entry point to inject process.env values into c.env */
  env?: Partial<Env>;
}

export function createApp(config: AppConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Inject env bindings (for Node.js mode where c.env isn't populated automatically)
  if (config.env) {
    app.use('*', async (c, next) => {
      for (const [key, value] of Object.entries(config.env!)) {
        if (value !== undefined) {
          (c.env as unknown as Record<string, unknown>)[key] = value;
        }
      }
      await next();
    });
  }

  // Inject adapters into Hono context
  app.use('*', async (c, next) => {
    c.set('adapter', config.adapter);
    c.set('tenantDb', config.tenantDb);
    await next();
  });

  // Global middleware
  app.use('*', secureHeaders());
  app.use('*', requestId());
  app.use('*', logger());
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id'],
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

  // Workspace routes (tenant authMiddleware)
  app.route('/api/v1/workspaces', workspaceRoutes);

  // Data routes (all use tenant authMiddleware)
  app.route('/api/v1/tables', tableRoutes);
  app.route('/api/v1', columnRoutes);
  app.route('/api/v1', rowRoutes);
  app.route('/api/v1', viewRoutes);
  app.route('/api/v1', selectOptionRoutes);
  app.route('/api/v1', relationRoutes);
  app.route('/api/v1', fileRefRoutes);

  app.notFound((c) => {
    return c.json({ error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` } }, 404);
  });

  return app;
}
