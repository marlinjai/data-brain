import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import { createFileRefSchema, reorderIdsSchema } from '@data-brain/shared';

const fileRefRoutes = new Hono<AppEnv>();
fileRefRoutes.use('*', authMiddleware);

async function verifyRowOwnership(c: any, adapter: any, rowId: string) {
  const row = await adapter.getRow(rowId);
  if (!row) throw ApiError.notFound('Row not found');
  const table = await adapter.getTable(row.tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Row not found');
  return row;
}

fileRefRoutes.post('/file-refs', async (c) => {
  const body = createFileRefSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, body.rowId);
  const ref = await adapter.addFileReference(body);
  return c.json(ref, 201);
});

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
