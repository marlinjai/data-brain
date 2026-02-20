import type { TenantContext } from '@data-brain/shared';

export interface Env {
  DB: D1Database;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  ADMIN_API_KEY?: string;
}

export interface Variables extends TenantContext {
  requestId: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: Variables;
};
