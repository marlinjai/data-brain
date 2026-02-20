import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from './error-handler';

export async function verifyWorkspaceAccess(c: Context<AppEnv>, workspaceId: string): Promise<void> {
  const tenant = c.get('tenant');
  const row = await c.env.DB.prepare(
    'SELECT id, tenant_id FROM workspaces WHERE id = ?'
  ).bind(workspaceId).first();

  if (!row || row.tenant_id !== tenant.id) {
    throw ApiError.notFound('Workspace not found');
  }
}
