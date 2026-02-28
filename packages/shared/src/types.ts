import type { BaseTenant, BaseWorkspace, BaseTenantContext } from '@marlinjai/brain-core';

/**
 * Tenant stored in Data Brain's own tenants table — extends BaseTenant with data-specific quota fields
 */
export interface Tenant extends BaseTenant {
  quotaRows: number;
  usedRows: number;
  maxTables: number;
}

/**
 * Tenant context attached to Hono request after auth
 */
export type TenantContext = BaseTenantContext<Tenant>;

/**
 * Public tenant info (no sensitive fields)
 */
export interface TenantInfo {
  id: string;
  name: string;
  quotaRows: number;
  usedRows: number;
  maxTables: number;
  createdAt: string; // ISO 8601
}

/**
 * Workspace within a tenant — extends BaseWorkspace with data-specific quota fields
 */
export interface Workspace extends BaseWorkspace {
  quotaRows: number | null;
  usedRows: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public workspace info (subset)
 */
export interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  quotaRows: number | null;
  usedRows: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Batch operation — one unit in a POST /rpc/batch request
 */
export interface BatchOperation {
  method: string;
  params: Record<string, unknown>;
}

/**
 * Result of a single operation in a batch
 */
export interface BatchResult {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}
