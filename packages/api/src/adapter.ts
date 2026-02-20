import type { Context } from 'hono';
import { D1Adapter } from '@marlinjai/data-table-adapter-d1';
import type { AppEnv } from './env';

export function getAdapter(c: Context<AppEnv>): D1Adapter {
  return new D1Adapter(c.env.DB);
}

export function getWorkspaceId(c: Context<AppEnv>): string {
  const headerWorkspaceId = c.req.header('X-Workspace-Id');
  if (headerWorkspaceId) {
    return headerWorkspaceId;
  }
  // Fallback: use tenant.id as workspace (backward compatible)
  return c.get('tenant').id;
}
