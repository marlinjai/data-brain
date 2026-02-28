import { serve } from '@hono/node-server';
import { createApp } from './app';
import { PostgresDataAdapter } from './adapters/data/postgres';
import { PostgresTenantAdapter } from './adapters/tenant/postgres';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const port = parseInt(process.env.PORT ?? '3001', 10);
  const connectionString = required('DATABASE_URL');

  // Data adapter — PostgreSQL (data-table operations)
  const adapter = new PostgresDataAdapter({ connectionString });

  // Tenant adapter — PostgreSQL (tenant/workspace management)
  const tenantDb = new PostgresTenantAdapter({ connectionString });

  // Run migrations
  console.log('Running database migrations…');
  await tenantDb.migrate();
  console.log('Migrations complete.');

  // Create Hono app with injected adapters and env bindings
  const app = createApp({
    adapter,
    tenantDb,
    env: {
      ADMIN_API_KEY: required('ADMIN_API_KEY'),
      ENVIRONMENT: (process.env.ENVIRONMENT as 'development' | 'staging' | 'production') ?? 'production',
    },
  });

  console.log(`Data Brain API listening on http://0.0.0.0:${port}`);

  serve({
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0',
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down…');
    await adapter.close();
    await tenantDb.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
