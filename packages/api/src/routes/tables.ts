import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import { createTableSchema, updateTableSchema } from '@data-brain/shared';

const tableRoutes = new Hono<AppEnv>();
tableRoutes.use('*', authMiddleware);

tableRoutes.get('/', async (c) => {
  const adapter = getAdapter(c);
  const workspaceId = getWorkspaceId(c);
  const tables = await adapter.listTables(workspaceId);
  return c.json(tables);
});

tableRoutes.post('/', async (c) => {
  const body = createTableSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const workspaceId = getWorkspaceId(c);
  const table = await adapter.createTable({ ...body, workspaceId });
  return c.json(table, 201);
});

tableRoutes.get('/:tableId', async (c) => {
  const adapter = getAdapter(c);
  const table = await adapter.getTable(c.req.param('tableId'));
  if (!table) throw ApiError.notFound('Table not found');
  if (table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  return c.json(table);
});

tableRoutes.patch('/:tableId', async (c) => {
  const updates = updateTableSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const existing = await adapter.getTable(c.req.param('tableId'));
  if (!existing || existing.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  const table = await adapter.updateTable(c.req.param('tableId'), updates);
  return c.json(table);
});

tableRoutes.delete('/:tableId', async (c) => {
  const adapter = getAdapter(c);
  const existing = await adapter.getTable(c.req.param('tableId'));
  if (!existing || existing.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  await adapter.deleteTable(c.req.param('tableId'));
  return c.json({ success: true });
});

export { tableRoutes };
