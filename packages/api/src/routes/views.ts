import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import { createViewSchema, updateViewSchema, reorderIdsSchema } from '@data-brain/shared';

const viewRoutes = new Hono<AppEnv>();
viewRoutes.use('*', authMiddleware);

async function verifyTableOwnership(c: any, adapter: any, tableId: string) {
  const table = await adapter.getTable(tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  return table;
}

viewRoutes.get('/tables/:tableId/views', async (c) => {
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  return c.json(await adapter.getViews(c.req.param('tableId')));
});

viewRoutes.post('/tables/:tableId/views', async (c) => {
  const body = createViewSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  const view = await adapter.createView({ ...body, tableId: c.req.param('tableId') });
  return c.json(view, 201);
});

viewRoutes.get('/views/:viewId', async (c) => {
  const adapter = getAdapter(c);
  const view = await adapter.getView(c.req.param('viewId'));
  if (!view) throw ApiError.notFound('View not found');
  await verifyTableOwnership(c, adapter, view.tableId);
  return c.json(view);
});

viewRoutes.patch('/views/:viewId', async (c) => {
  const updates = updateViewSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const view = await adapter.getView(c.req.param('viewId'));
  if (!view) throw ApiError.notFound('View not found');
  await verifyTableOwnership(c, adapter, view.tableId);
  return c.json(await adapter.updateView(c.req.param('viewId'), updates));
});

viewRoutes.delete('/views/:viewId', async (c) => {
  const adapter = getAdapter(c);
  const view = await adapter.getView(c.req.param('viewId'));
  if (!view) throw ApiError.notFound('View not found');
  await verifyTableOwnership(c, adapter, view.tableId);
  await adapter.deleteView(c.req.param('viewId'));
  return c.json({ success: true });
});

viewRoutes.put('/tables/:tableId/views/reorder', async (c) => {
  const viewIds = reorderIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  await adapter.reorderViews(c.req.param('tableId'), viewIds);
  return c.json({ success: true });
});

export { viewRoutes };
