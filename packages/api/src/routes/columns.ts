import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { getAdapter } from '../adapter';
import { verifyTableOwnership, verifyColumnOwnership } from '../middleware/ownership';
import { createColumnSchema, updateColumnSchema, reorderIdsSchema } from '@data-brain/shared';

const columnRoutes = new Hono<AppEnv>();
columnRoutes.use('*', authMiddleware);

columnRoutes.get('/tables/:tableId/columns', async (c) => {
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  const columns = await adapter.getColumns(c.req.param('tableId'));
  return c.json(columns);
});

columnRoutes.post('/tables/:tableId/columns', async (c) => {
  const body = createColumnSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  const column = await adapter.createColumn({ ...body, tableId: c.req.param('tableId') });
  return c.json(column, 201);
});

columnRoutes.get('/columns/:columnId', async (c) => {
  const adapter = getAdapter(c);
  const column = await verifyColumnOwnership(c, adapter, c.req.param('columnId'));
  return c.json(column);
});

columnRoutes.patch('/columns/:columnId', async (c) => {
  const updates = updateColumnSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyColumnOwnership(c, adapter, c.req.param('columnId'));
  const updated = await adapter.updateColumn(c.req.param('columnId'), updates);
  return c.json(updated);
});

columnRoutes.delete('/columns/:columnId', async (c) => {
  const adapter = getAdapter(c);
  await verifyColumnOwnership(c, adapter, c.req.param('columnId'));
  await adapter.deleteColumn(c.req.param('columnId'));
  return c.json({ success: true });
});

columnRoutes.put('/tables/:tableId/columns/reorder', async (c) => {
  const columnIds = reorderIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  await adapter.reorderColumns(c.req.param('tableId'), columnIds);
  return c.json({ success: true });
});

export { columnRoutes };
