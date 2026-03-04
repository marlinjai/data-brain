import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from './error-handler';
import { getTenantDb, getWorkspaceId } from '../adapter';

/**
 * Check that creating `count` rows would not exceed tenant or workspace quotas.
 * Throws ApiError.quotaExceeded() if the limit would be exceeded.
 */
export async function checkRowQuota(c: Context<AppEnv>, count: number = 1): Promise<void> {
  const tenant = c.get('tenant');
  if (tenant.usedRows + count > tenant.quotaRows) {
    throw ApiError.quotaExceeded(
      `Row quota exceeded. Used: ${tenant.usedRows}, limit: ${tenant.quotaRows}`,
    );
  }

  const workspaceId = getWorkspaceId(c);
  const tenantDb = getTenantDb(c);
  const workspace = await tenantDb.getWorkspace(workspaceId, tenant.id);
  if (workspace?.quotaRows != null && workspace.usedRows + count > workspace.quotaRows) {
    throw ApiError.quotaExceeded(
      `Workspace row quota exceeded. Used: ${workspace.usedRows}, limit: ${workspace.quotaRows}`,
    );
  }
}

/**
 * Check that creating a new table would not exceed the tenant's maxTables quota.
 * Throws ApiError.quotaExceeded() if the limit would be exceeded.
 */
export async function checkTableQuota(c: Context<AppEnv>): Promise<void> {
  const tenant = c.get('tenant');
  const tenantDb = getTenantDb(c);
  const tableCount = await tenantDb.countTenantTables(tenant.id);
  if (tableCount >= tenant.maxTables) {
    throw ApiError.quotaExceeded(
      `Table quota exceeded. Used: ${tableCount}, limit: ${tenant.maxTables}`,
    );
  }
}

/**
 * Increment used_rows on both tenant and workspace after rows are created.
 */
export async function trackRowsCreated(c: Context<AppEnv>, count: number = 1): Promise<void> {
  const tenant = c.get('tenant');
  const workspaceId = getWorkspaceId(c);
  const tenantDb = getTenantDb(c);
  await tenantDb.incrementUsedRows(tenant.id, workspaceId, count);
}

/**
 * Decrement used_rows on both tenant and workspace after rows are deleted.
 */
export async function trackRowsDeleted(c: Context<AppEnv>, count: number = 1): Promise<void> {
  const tenant = c.get('tenant');
  const workspaceId = getWorkspaceId(c);
  const tenantDb = getTenantDb(c);
  await tenantDb.decrementUsedRows(tenant.id, workspaceId, count);
}
