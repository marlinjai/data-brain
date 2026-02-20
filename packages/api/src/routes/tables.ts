import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { getAdapter, getWorkspaceId } from '../adapter';
import { verifyTableOwnership } from '../middleware/ownership';
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
  const table = await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  return c.json(table);
});

tableRoutes.patch('/:tableId', async (c) => {
  const updates = updateTableSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  const table = await adapter.updateTable(c.req.param('tableId'), updates);
  return c.json(table);
});

tableRoutes.delete('/:tableId', async (c) => {
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  await adapter.deleteTable(c.req.param('tableId'));
  return c.json({ success: true });
});

export { tableRoutes };
