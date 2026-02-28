import type { Context } from 'hono';
import type { DatabaseAdapter } from '@marlinjai/data-table-core';
import type { AppEnv } from './env';
import type { TenantDatabaseAdapter } from './tenant-adapter';

export function getAdapter(c: Context<AppEnv>): DatabaseAdapter {
  return c.get('adapter');
}

export function getTenantDb(c: Context<AppEnv>): TenantDatabaseAdapter {
  return c.get('tenantDb');
}

export function getWorkspaceId(c: Context<AppEnv>): string {
  const headerWorkspaceId = c.req.header('X-Workspace-Id');
  if (headerWorkspaceId) {
    return headerWorkspaceId;
  }
  // Fallback: use tenant.id as workspace (backward compatible)
  return c.get('tenant').id;
}
