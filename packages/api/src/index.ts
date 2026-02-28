import type { Env } from './env';
import { D1Adapter } from '@marlinjai/data-table-adapter-d1';
import { D1TenantAdapter } from './adapters/tenant/d1';
import { createApp } from './app';

// Re-export for consumers
export { createApp } from './app';
export type { AppConfig } from './app';

// Export for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const app = createApp({
      adapter: new D1Adapter(env.DB),
      tenantDb: new D1TenantAdapter(env.DB),
    });
    return app.fetch(request, env, ctx);
  },
};
