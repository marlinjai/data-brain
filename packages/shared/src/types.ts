/**
 * Tenant stored in Data Brain's own tenants table
 */
export interface Tenant {
  id: string;
  name: string;
  apiKeyHash: string;
  quotaRows: number;
  usedRows: number;
  maxTables: number;
  createdAt: number; // Unix timestamp
  updatedAt: number;
}

/**
 * Tenant context attached to Hono request after auth
 */
export interface TenantContext {
  tenant: Tenant;
}

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
 * Workspace within a tenant
 */
export interface Workspace {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  quotaRows: number | null;
  usedRows: number;
  metadata: Record<string, unknown> | null;
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
