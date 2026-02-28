import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from './error-handler';

export async function verifyWorkspaceAccess(c: Context<AppEnv>, workspaceId: string): Promise<void> {
  const tenant = c.get('tenant');
  const hasAccess = await c.get('tenantDb').verifyWorkspaceAccess(workspaceId, tenant.id);
  if (!hasAccess) {
    throw ApiError.notFound('Workspace not found');
  }
}
