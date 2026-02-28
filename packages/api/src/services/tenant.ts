import type { Tenant, TenantInfo } from '@data-brain/shared';

export function toTenantInfo(tenant: Tenant): TenantInfo {
  return {
    id: tenant.id,
    name: tenant.name,
    quotaRows: tenant.quotaRows,
    usedRows: tenant.usedRows,
    maxTables: tenant.maxTables,
    createdAt: new Date(tenant.createdAt).toISOString(),
  };
}
