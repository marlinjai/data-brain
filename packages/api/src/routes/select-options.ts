import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import { createSelectOptionSchema, updateSelectOptionSchema, reorderIdsSchema } from '@data-brain/shared';

const selectOptionRoutes = new Hono<AppEnv>();
selectOptionRoutes.use('*', authMiddleware);

async function verifyColumnOwnership(c: any, adapter: any, columnId: string) {
  const column = await adapter.getColumn(columnId);
  if (!column) throw ApiError.notFound('Column not found');
  const table = await adapter.getTable(column.tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Column not found');
  return column;
}

selectOptionRoutes.get('/columns/:columnId/options', async (c) => {
  const adapter = getAdapter(c);
  await verifyColumnOwnership(c, adapter, c.req.param('columnId'));
  return c.json(await adapter.getSelectOptions(c.req.param('columnId')));
});

selectOptionRoutes.post('/columns/:columnId/options', async (c) => {
  const body = createSelectOptionSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyColumnOwnership(c, adapter, c.req.param('columnId'));
  const option = await adapter.createSelectOption({ ...body, columnId: c.req.param('columnId') });
  return c.json(option, 201);
});

selectOptionRoutes.patch('/options/:optionId', async (c) => {
  const updates = updateSelectOptionSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const updated = await adapter.updateSelectOption(c.req.param('optionId'), updates);
  return c.json(updated);
});

selectOptionRoutes.delete('/options/:optionId', async (c) => {
  const adapter = getAdapter(c);
  await adapter.deleteSelectOption(c.req.param('optionId'));
  return c.json({ success: true });
});

selectOptionRoutes.put('/columns/:columnId/options/reorder', async (c) => {
  const optionIds = reorderIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyColumnOwnership(c, adapter, c.req.param('columnId'));
  await adapter.reorderSelectOptions(c.req.param('columnId'), optionIds);
  return c.json({ success: true });
});

export { selectOptionRoutes };
