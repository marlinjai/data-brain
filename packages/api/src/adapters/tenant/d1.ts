import type { Tenant } from '@data-brain/shared';
import { DEFAULT_QUOTA_ROWS, DEFAULT_MAX_TABLES } from '@data-brain/shared';
import { generateApiKey, hashApiKey } from '@marlinjai/brain-core';
import type {
  TenantDatabaseAdapter,
  CreateTenantInput,
  CreateTenantResult,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceRow,
} from '../../tenant-adapter';

export class D1TenantAdapter implements TenantDatabaseAdapter {
  constructor(private db: D1Database) {}

  async getTenantByKeyHash(keyHash: string): Promise<Tenant | null> {
    const row = await this.db.prepare(
      'SELECT id, name, api_key_hash, quota_rows, used_rows, max_tables, created_at, updated_at FROM tenants WHERE api_key_hash = ?'
    ).bind(keyHash).first();

    if (!row) return null;

    return {
      id: row.id as string,
      name: row.name as string,
      apiKeyHash: row.api_key_hash as string,
      quotaRows: row.quota_rows as number,
      usedRows: row.used_rows as number,
      maxTables: row.max_tables as number,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  async verifyWorkspaceAccess(workspaceId: string, tenantId: string): Promise<boolean> {
    const row = await this.db.prepare(
      'SELECT id, tenant_id FROM workspaces WHERE id = ?'
    ).bind(workspaceId).first();

    return !!row && row.tenant_id === tenantId;
  }

  async createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
    const id = crypto.randomUUID();
    const apiKey = generateApiKey();
    const keyHash = await hashApiKey(apiKey);
    const now = Date.now();

    await this.db.prepare(
      `INSERT INTO tenants (id, name, api_key_hash, quota_rows, max_tables, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      input.name,
      keyHash,
      input.quotaRows ?? DEFAULT_QUOTA_ROWS,
      input.maxTables ?? DEFAULT_MAX_TABLES,
      now,
      now,
    ).run();

    return {
      tenant: {
        id,
        name: input.name,
        quotaRows: input.quotaRows ?? DEFAULT_QUOTA_ROWS,
        usedRows: 0,
        maxTables: input.maxTables ?? DEFAULT_MAX_TABLES,
        createdAt: new Date(now).toISOString(),
      },
      apiKey,
    };
  }

  async listWorkspaces(tenantId: string): Promise<WorkspaceRow[]> {
    const { results } = await this.db.prepare(
      'SELECT id, tenant_id, name, slug, quota_rows, used_rows, metadata, created_at, updated_at FROM workspaces WHERE tenant_id = ? ORDER BY created_at ASC'
    ).bind(tenantId).all();

    return (results ?? []).map((row) => this.mapWorkspaceRow(row));
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceRow> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

    await this.db.prepare(
      'INSERT INTO workspaces (id, tenant_id, name, slug, quota_rows, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, input.tenantId, input.name, input.slug, input.quotaRows ?? null, metadataJson, now, now).run();

    return {
      id,
      tenantId: input.tenantId,
      name: input.name,
      slug: input.slug,
      quotaRows: input.quotaRows ?? null,
      usedRows: 0,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getWorkspace(workspaceId: string, tenantId: string): Promise<WorkspaceRow | null> {
    const row = await this.db.prepare(
      'SELECT id, tenant_id, name, slug, quota_rows, used_rows, metadata, created_at, updated_at FROM workspaces WHERE id = ? AND tenant_id = ?'
    ).bind(workspaceId, tenantId).first();

    if (!row) return null;
    return this.mapWorkspaceRow(row);
  }

  async updateWorkspace(workspaceId: string, tenantId: string, updates: UpdateWorkspaceInput): Promise<WorkspaceRow | null> {
    // Verify ownership
    const existing = await this.db.prepare(
      'SELECT id FROM workspaces WHERE id = ? AND tenant_id = ?'
    ).bind(workspaceId, tenantId).first();
    if (!existing) return null;

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.quotaRows !== undefined) {
      setClauses.push('quota_rows = ?');
      values.push(updates.quotaRows);
    }
    if (updates.metadata !== undefined) {
      setClauses.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }

    if (setClauses.length === 0) return null;

    setClauses.push('updated_at = ?');
    const now = new Date().toISOString();
    values.push(now);
    values.push(workspaceId);
    values.push(tenantId);

    await this.db.prepare(
      `UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = ? AND tenant_id = ?`
    ).bind(...values).run();

    // Return updated workspace
    const row = await this.db.prepare(
      'SELECT id, tenant_id, name, slug, quota_rows, used_rows, metadata, created_at, updated_at FROM workspaces WHERE id = ?'
    ).bind(workspaceId).first();

    return row ? this.mapWorkspaceRow(row) : null;
  }

  async deleteWorkspace(workspaceId: string, tenantId: string): Promise<boolean> {
    // Verify ownership
    const existing = await this.db.prepare(
      'SELECT id FROM workspaces WHERE id = ? AND tenant_id = ?'
    ).bind(workspaceId, tenantId).first();
    if (!existing) return false;

    // Delete all tables in this workspace (cascades to rows, columns, views, etc.)
    await this.db.prepare(
      'DELETE FROM dt_tables WHERE workspace_id = ?'
    ).bind(workspaceId).run();

    // Delete the workspace itself
    await this.db.prepare(
      'DELETE FROM workspaces WHERE id = ? AND tenant_id = ?'
    ).bind(workspaceId, tenantId).run();

    return true;
  }

  private mapWorkspaceRow(row: Record<string, unknown>): WorkspaceRow {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      slug: row.slug as string,
      quotaRows: row.quota_rows as number | null,
      usedRows: row.used_rows as number,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
