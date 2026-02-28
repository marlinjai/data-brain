import type { TenantContext } from '@data-brain/shared';
import type { DatabaseAdapter } from '@marlinjai/data-table-core';
import type { TenantDatabaseAdapter } from './tenant-adapter';

export interface Env {
  DB: D1Database;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  ADMIN_API_KEY?: string;
}

export interface Variables extends TenantContext {
  requestId: string;
  adapter: DatabaseAdapter;
  tenantDb: TenantDatabaseAdapter;
}

export type AppEnv = {
  Bindings: Env;
  Variables: Variables;
};
