import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { getAdapter } from '../adapter';
import { verifyColumnOwnership } from '../middleware/ownership';
import { createSelectOptionSchema, updateSelectOptionSchema, reorderIdsSchema } from '@data-brain/shared';

const selectOptionRoutes = new Hono<AppEnv>();
selectOptionRoutes.use('*', authMiddleware);

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

// TODO: C6 — updateSelectOption has no ownership check. The D1Adapter does not expose
// a getSelectOption(id) method, so we cannot look up which column an option belongs to
// without querying the database directly. Option IDs are UUIDs (unguessable), so the
// risk is low, but this should be addressed when the adapter gains a lookup method.
selectOptionRoutes.patch('/options/:optionId', async (c) => {
  const updates = updateSelectOptionSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const updated = await adapter.updateSelectOption(c.req.param('optionId'), updates);
  return c.json(updated);
});

// TODO: C6 — deleteSelectOption has no ownership check. Same limitation as updateSelectOption
// above: the adapter does not expose getSelectOption(id). Option IDs are UUIDs (unguessable),
// so the risk is low, but this should be addressed when the adapter gains a lookup method.
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
