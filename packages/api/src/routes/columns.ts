import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import { createColumnSchema, updateColumnSchema, reorderIdsSchema } from '@data-brain/shared';

const columnRoutes = new Hono<AppEnv>();
columnRoutes.use('*', authMiddleware);

columnRoutes.get('/tables/:tableId/columns', async (c) => {
  const adapter = getAdapter(c);
  const table = await adapter.getTable(c.req.param('tableId'));
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  const columns = await adapter.getColumns(c.req.param('tableId'));
  return c.json(columns);
});

columnRoutes.post('/tables/:tableId/columns', async (c) => {
  const body = createColumnSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const table = await adapter.getTable(c.req.param('tableId'));
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  const column = await adapter.createColumn({ ...body, tableId: c.req.param('tableId') });
  return c.json(column, 201);
});

columnRoutes.get('/columns/:columnId', async (c) => {
  const adapter = getAdapter(c);
  const column = await adapter.getColumn(c.req.param('columnId'));
  if (!column) throw ApiError.notFound('Column not found');
  const table = await adapter.getTable(column.tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Column not found');
  return c.json(column);
});

columnRoutes.patch('/columns/:columnId', async (c) => {
  const updates = updateColumnSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const column = await adapter.getColumn(c.req.param('columnId'));
  if (!column) throw ApiError.notFound('Column not found');
  const table = await adapter.getTable(column.tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Column not found');
  const updated = await adapter.updateColumn(c.req.param('columnId'), updates);
  return c.json(updated);
});

columnRoutes.delete('/columns/:columnId', async (c) => {
  const adapter = getAdapter(c);
  const column = await adapter.getColumn(c.req.param('columnId'));
  if (!column) throw ApiError.notFound('Column not found');
  const table = await adapter.getTable(column.tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Column not found');
  await adapter.deleteColumn(c.req.param('columnId'));
  return c.json({ success: true });
});

columnRoutes.put('/tables/:tableId/columns/reorder', async (c) => {
  const columnIds = reorderIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const table = await adapter.getTable(c.req.param('tableId'));
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  await adapter.reorderColumns(c.req.param('tableId'), columnIds);
  return c.json({ success: true });
});

export { columnRoutes };
