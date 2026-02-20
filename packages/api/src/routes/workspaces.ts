import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { createWorkspaceSchema, updateWorkspaceSchema } from '@data-brain/shared';

const workspaceRoutes = new Hono<AppEnv>();
workspaceRoutes.use('*', authMiddleware);

// List workspaces for tenant
workspaceRoutes.get('/', async (c) => {
  const tenant = c.get('tenant');
  const { results } = await c.env.DB.prepare(
    'SELECT id, tenant_id, name, slug, quota_rows, used_rows, metadata, created_at, updated_at FROM workspaces WHERE tenant_id = ? ORDER BY created_at ASC'
  ).bind(tenant.id).all();

  const workspaces = (results ?? []).map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    slug: row.slug as string,
    quotaRows: row.quota_rows as number | null,
    usedRows: row.used_rows as number,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));

  return c.json(workspaces);
});

// Create workspace
workspaceRoutes.post('/', async (c) => {
  const tenant = c.get('tenant');
  const body = createWorkspaceSchema.parse(await c.req.json());

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const metadataJson = body.metadata ? JSON.stringify(body.metadata) : null;

  try {
    await c.env.DB.prepare(
      'INSERT INTO workspaces (id, tenant_id, name, slug, quota_rows, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, tenant.id, body.name, body.slug, body.quotaRows ?? null, metadataJson, now, now).run();
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw ApiError.conflict(`Workspace with slug '${body.slug}' already exists`);
    }
    throw err;
  }

  const workspace = {
    id,
    tenantId: tenant.id,
    name: body.name,
    slug: body.slug,
    quotaRows: body.quotaRows ?? null,
    usedRows: 0,
    metadata: body.metadata ?? null,
    createdAt: now,
    updatedAt: now,
  };

  return c.json(workspace, 201);
});

// Get workspace
workspaceRoutes.get('/:workspaceId', async (c) => {
  const tenant = c.get('tenant');
  const workspaceId = c.req.param('workspaceId');

  const row = await c.env.DB.prepare(
    'SELECT id, tenant_id, name, slug, quota_rows, used_rows, metadata, created_at, updated_at FROM workspaces WHERE id = ? AND tenant_id = ?'
  ).bind(workspaceId, tenant.id).first();

  if (!row) throw ApiError.notFound('Workspace not found');

  return c.json({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    slug: row.slug as string,
    quotaRows: row.quota_rows as number | null,
    usedRows: row.used_rows as number,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  });
});

// Update workspace
workspaceRoutes.patch('/:workspaceId', async (c) => {
  const tenant = c.get('tenant');
  const workspaceId = c.req.param('workspaceId');
  const body = updateWorkspaceSchema.parse(await c.req.json());

  // Verify ownership
  const existing = await c.env.DB.prepare(
    'SELECT id FROM workspaces WHERE id = ? AND tenant_id = ?'
  ).bind(workspaceId, tenant.id).first();
  if (!existing) throw ApiError.notFound('Workspace not found');

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    setClauses.push('name = ?');
    values.push(body.name);
  }
  if (body.quotaRows !== undefined) {
    setClauses.push('quota_rows = ?');
    values.push(body.quotaRows);
  }
  if (body.metadata !== undefined) {
    setClauses.push('metadata = ?');
    values.push(JSON.stringify(body.metadata));
  }

  if (setClauses.length === 0) throw ApiError.badRequest('No fields to update');

  setClauses.push('updated_at = ?');
  const now = new Date().toISOString();
  values.push(now);
  values.push(workspaceId);
  values.push(tenant.id);

  await c.env.DB.prepare(
    `UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = ? AND tenant_id = ?`
  ).bind(...values).run();

  // Return updated workspace
  const row = await c.env.DB.prepare(
    'SELECT id, tenant_id, name, slug, quota_rows, used_rows, metadata, created_at, updated_at FROM workspaces WHERE id = ?'
  ).bind(workspaceId).first();

  return c.json({
    id: row!.id as string,
    tenantId: row!.tenant_id as string,
    name: row!.name as string,
    slug: row!.slug as string,
    quotaRows: row!.quota_rows as number | null,
    usedRows: row!.used_rows as number,
    metadata: row!.metadata ? JSON.parse(row!.metadata as string) : null,
    createdAt: row!.created_at as string,
    updatedAt: row!.updated_at as string,
  });
});

// Delete workspace (and all its data)
workspaceRoutes.delete('/:workspaceId', async (c) => {
  const tenant = c.get('tenant');
  const workspaceId = c.req.param('workspaceId');

  // Verify ownership
  const existing = await c.env.DB.prepare(
    'SELECT id FROM workspaces WHERE id = ? AND tenant_id = ?'
  ).bind(workspaceId, tenant.id).first();
  if (!existing) throw ApiError.notFound('Workspace not found');

  // Delete all tables in this workspace (cascades to rows, columns, views, etc.)
  await c.env.DB.prepare(
    'DELETE FROM dt_tables WHERE workspace_id = ?'
  ).bind(workspaceId).run();

  // Delete the workspace itself
  await c.env.DB.prepare(
    'DELETE FROM workspaces WHERE id = ? AND tenant_id = ?'
  ).bind(workspaceId, tenant.id).run();

  return c.json({ success: true });
});

export { workspaceRoutes };
