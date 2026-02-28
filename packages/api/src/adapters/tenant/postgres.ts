import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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

export interface PostgresTenantAdapterConfig {
  connectionString: string;
  migrationPath?: string;
}

export class PostgresTenantAdapter implements TenantDatabaseAdapter {
  private sql: postgres.Sql;
  private migrationPath: string | undefined;

  constructor(config: PostgresTenantAdapterConfig) {
    this.sql = postgres(config.connectionString);
    this.migrationPath = config.migrationPath;
  }

  /** Gracefully close the connection pool */
  async close(): Promise<void> {
    await this.sql.end();
  }

  /** Run database migrations */
  async migrate(): Promise<void> {
    const sqlPath =
      this.migrationPath ??
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations/001_init.sql');
    const migrationSQL = readFileSync(sqlPath, 'utf-8');
    await this.sql.unsafe(migrationSQL);
  }

  async getTenantByKeyHash(keyHash: string): Promise<Tenant | null> {
    const rows = await this.sql`
      SELECT id, name, api_key_hash, quota_rows, used_rows, max_tables, created_at, updated_at
      FROM tenants WHERE api_key_hash = ${keyHash}
    `;

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id as string,
      name: row.name as string,
      apiKeyHash: row.api_key_hash as string,
      quotaRows: Number(row.quota_rows),
      usedRows: Number(row.used_rows),
      maxTables: Number(row.max_tables),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  async verifyWorkspaceAccess(workspaceId: string, tenantId: string): Promise<boolean> {
    const rows = await this.sql`
      SELECT id, tenant_id FROM workspaces WHERE id = ${workspaceId}
    `;

    const row = rows[0];
    return !!row && row.tenant_id === tenantId;
  }

  async createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
    const id = crypto.randomUUID();
    const apiKey = generateApiKey();
    const keyHash = await hashApiKey(apiKey);
    const now = Date.now();

    await this.sql`
      INSERT INTO tenants (id, name, api_key_hash, quota_rows, max_tables, created_at, updated_at)
      VALUES (${id}, ${input.name}, ${keyHash}, ${input.quotaRows ?? DEFAULT_QUOTA_ROWS}, ${input.maxTables ?? DEFAULT_MAX_TABLES}, ${now}, ${now})
    `;

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
    const rows = await this.sql`
      SELECT id, tenant_id, name, slug, quota_rows, used_rows, metadata, created_at, updated_at
      FROM workspaces WHERE tenant_id = ${tenantId} ORDER BY created_at ASC
    `;

    return rows.map((row) => this.mapWorkspaceRow(row));
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceRow> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

    await this.sql`
      INSERT INTO workspaces (id, tenant_id, name, slug, quota_rows, metadata, created_at, updated_at)
      VALUES (${id}, ${input.tenantId}, ${input.name}, ${input.slug}, ${input.quotaRows ?? null}, ${metadataJson}, ${now}, ${now})
    `;

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
    const rows = await this.sql`
      SELECT id, tenant_id, name, slug, quota_rows, used_rows, metadata, created_at, updated_at
      FROM workspaces WHERE id = ${workspaceId} AND tenant_id = ${tenantId}
    `;

    const row = rows[0];
    return row ? this.mapWorkspaceRow(row) : null;
  }

  async updateWorkspace(workspaceId: string, tenantId: string, updates: UpdateWorkspaceInput): Promise<WorkspaceRow | null> {
    // Verify ownership
    const existing = await this.sql`SELECT id FROM workspaces WHERE id = ${workspaceId} AND tenant_id = ${tenantId}`;
    if (existing.length === 0) return null;

    const sets: postgres.PendingQuery<postgres.Row[]>[] = [];

    if (updates.name !== undefined) sets.push(this.sql`name = ${updates.name}`);
    if (updates.quotaRows !== undefined) sets.push(this.sql`quota_rows = ${updates.quotaRows}`);
    if (updates.metadata !== undefined) sets.push(this.sql`metadata = ${JSON.stringify(updates.metadata)}`);

    if (sets.length === 0) return null;

    const now = new Date().toISOString();
    sets.push(this.sql`updated_at = ${now}`);

    const setClause = sets.reduce((acc, s) => this.sql`${acc}, ${s}`);
    await this.sql`UPDATE workspaces SET ${setClause} WHERE id = ${workspaceId} AND tenant_id = ${tenantId}`;

    return this.getWorkspace(workspaceId, tenantId);
  }

  async deleteWorkspace(workspaceId: string, tenantId: string): Promise<boolean> {
    // Verify ownership
    const existing = await this.sql`SELECT id FROM workspaces WHERE id = ${workspaceId} AND tenant_id = ${tenantId}`;
    if (existing.length === 0) return false;

    // Delete all tables in this workspace (cascades to rows, columns, views, etc.)
    await this.sql`DELETE FROM dt_tables WHERE workspace_id = ${workspaceId}`;

    // Delete the workspace itself
    await this.sql`DELETE FROM workspaces WHERE id = ${workspaceId} AND tenant_id = ${tenantId}`;

    return true;
  }

  private mapWorkspaceRow(row: postgres.Row): WorkspaceRow {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      slug: row.slug as string,
      quotaRows: row.quota_rows !== null && row.quota_rows !== undefined ? Number(row.quota_rows) : null,
      usedRows: Number(row.used_rows ?? 0),
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
