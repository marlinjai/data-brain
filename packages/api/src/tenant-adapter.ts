import type { Tenant, TenantInfo } from '@data-brain/shared';

/**
 * Input for creating a new tenant
 */
export interface CreateTenantInput {
  name: string;
  quotaRows?: number;
  maxTables?: number;
}

/**
 * Result of creating a tenant
 */
export interface CreateTenantResult {
  tenant: TenantInfo;
  apiKey: string;
}

/**
 * Input for creating a workspace
 */
export interface CreateWorkspaceInput {
  tenantId: string;
  name: string;
  slug: string;
  quotaRows?: number | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Input for updating a workspace
 */
export interface UpdateWorkspaceInput {
  name?: string;
  quotaRows?: number | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Workspace row as returned from the database
 */
export interface WorkspaceRow {
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
 * Database adapter interface for tenant and workspace management.
 *
 * Abstracts the 8 tenant/workspace queries currently scattered across
 * middleware, routes, and services as raw D1 calls.
 */
export interface TenantDatabaseAdapter {
  /**
   * Look up a tenant by their hashed API key.
   * Used by auth middleware.
   */
  getTenantByKeyHash(keyHash: string): Promise<Tenant | null>;

  /**
   * Verify a workspace belongs to a tenant.
   * Returns true if the workspace exists and belongs to the tenant.
   */
  verifyWorkspaceAccess(workspaceId: string, tenantId: string): Promise<boolean>;

  /**
   * Create a new tenant with a hashed API key.
   * Returns the tenant info and the raw (unhashed) API key.
   */
  createTenant(input: CreateTenantInput): Promise<CreateTenantResult>;

  /**
   * List all workspaces for a tenant.
   */
  listWorkspaces(tenantId: string): Promise<WorkspaceRow[]>;

  /**
   * Create a new workspace within a tenant.
   */
  createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceRow>;

  /**
   * Get a single workspace by ID, scoped to a tenant.
   */
  getWorkspace(workspaceId: string, tenantId: string): Promise<WorkspaceRow | null>;

  /**
   * Update a workspace. Returns the updated workspace.
   */
  updateWorkspace(workspaceId: string, tenantId: string, updates: UpdateWorkspaceInput): Promise<WorkspaceRow | null>;

  /**
   * Delete a workspace and all its data (tables, rows, etc.).
   */
  deleteWorkspace(workspaceId: string, tenantId: string): Promise<boolean>;
}
