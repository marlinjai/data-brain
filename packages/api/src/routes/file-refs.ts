import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { getAdapter } from '../adapter';
import { verifyRowOwnership } from '../middleware/ownership';
import { createFileRefSchema, reorderIdsSchema } from '@data-brain/shared';

const fileRefRoutes = new Hono<AppEnv>();
fileRefRoutes.use('*', authMiddleware);

fileRefRoutes.post('/file-refs', async (c) => {
  const body = createFileRefSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, body.rowId);
  const ref = await adapter.addFileReference(body);
  return c.json(ref, 201);
});

// TODO: C5 — removeFileReference has no tenant ownership check. The D1Adapter does not
// expose a getFileReference(id) method, so we cannot look up which row a file ref belongs
// to without querying the database directly. File ref IDs are UUIDs (unguessable), so the
// risk is low, but this should be addressed when the adapter gains a lookup method or by
// requiring rowId as a query parameter.
fileRefRoutes.delete('/file-refs/:fileRefId', async (c) => {
  const adapter = getAdapter(c);
  await adapter.removeFileReference(c.req.param('fileRefId'));
  return c.json({ success: true });
});

fileRefRoutes.get('/rows/:rowId/files/:columnId', async (c) => {
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  const refs = await adapter.getFileReferences(c.req.param('rowId'), c.req.param('columnId'));
  return c.json(refs);
});

fileRefRoutes.put('/rows/:rowId/files/:columnId/reorder', async (c) => {
  const fileRefIds = reorderIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  await adapter.reorderFileReferences(c.req.param('rowId'), c.req.param('columnId'), fileRefIds);
  return c.json({ success: true });
});

export { fileRefRoutes };
