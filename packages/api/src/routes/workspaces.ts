import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getTenantDb } from '../adapter';
import { createWorkspaceSchema, updateWorkspaceSchema } from '@data-brain/shared';

const workspaceRoutes = new Hono<AppEnv>();
workspaceRoutes.use('*', authMiddleware);

// List workspaces for tenant
workspaceRoutes.get('/', async (c) => {
  const tenant = c.get('tenant');
  const tenantDb = getTenantDb(c);
  const workspaces = await tenantDb.listWorkspaces(tenant.id);
  return c.json(workspaces);
});

// Create workspace
workspaceRoutes.post('/', async (c) => {
  const tenant = c.get('tenant');
  const body = createWorkspaceSchema.parse(await c.req.json());
  const tenantDb = getTenantDb(c);

  try {
    const workspace = await tenantDb.createWorkspace({
      tenantId: tenant.id,
      name: body.name,
      slug: body.slug,
      quotaRows: body.quotaRows,
      metadata: body.metadata,
    });
    return c.json(workspace, 201);
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes('UNIQUE constraint failed') || err.message.includes('unique constraint'))) {
      throw ApiError.conflict(`Workspace with slug '${body.slug}' already exists`);
    }
    throw err;
  }
});

// Get workspace
workspaceRoutes.get('/:workspaceId', async (c) => {
  const tenant = c.get('tenant');
  const workspaceId = c.req.param('workspaceId');
  const tenantDb = getTenantDb(c);

  const workspace = await tenantDb.getWorkspace(workspaceId, tenant.id);
  if (!workspace) throw ApiError.notFound('Workspace not found');
  return c.json(workspace);
});

// Update workspace
workspaceRoutes.patch('/:workspaceId', async (c) => {
  const tenant = c.get('tenant');
  const workspaceId = c.req.param('workspaceId');
  const body = updateWorkspaceSchema.parse(await c.req.json());
  const tenantDb = getTenantDb(c);

  if (body.name === undefined && body.quotaRows === undefined && body.metadata === undefined) {
    throw ApiError.badRequest('No fields to update');
  }

  const workspace = await tenantDb.updateWorkspace(workspaceId, tenant.id, body);
  if (!workspace) throw ApiError.notFound('Workspace not found');
  return c.json(workspace);
});

// Delete workspace (and all its data)
workspaceRoutes.delete('/:workspaceId', async (c) => {
  const tenant = c.get('tenant');
  const workspaceId = c.req.param('workspaceId');
  const tenantDb = getTenantDb(c);

  const deleted = await tenantDb.deleteWorkspace(workspaceId, tenant.id);
  if (!deleted) throw ApiError.notFound('Workspace not found');
  return c.json({ success: true });
});

export { workspaceRoutes };
