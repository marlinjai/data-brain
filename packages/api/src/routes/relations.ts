import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter, getWorkspaceId } from '../adapter';
import { createRelationSchema, deleteRelationSchema } from '@data-brain/shared';

const relationRoutes = new Hono<AppEnv>();
relationRoutes.use('*', authMiddleware);

async function verifyRowOwnership(c: any, adapter: any, rowId: string) {
  const row = await adapter.getRow(rowId);
  if (!row) throw ApiError.notFound('Row not found');
  const table = await adapter.getTable(row.tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Row not found');
  return row;
}

relationRoutes.post('/relations', async (c) => {
  const body = createRelationSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, body.sourceRowId);
  await adapter.createRelation(body);
  return c.json({ success: true }, 201);
});

relationRoutes.delete('/relations', async (c) => {
  const body = deleteRelationSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, body.sourceRowId);
  await adapter.deleteRelation(body.sourceRowId, body.columnId, body.targetRowId);
  return c.json({ success: true });
});

relationRoutes.get('/rows/:rowId/relations/:columnId', async (c) => {
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  const rows = await adapter.getRelatedRows(c.req.param('rowId'), c.req.param('columnId'));
  return c.json(rows);
});

relationRoutes.get('/rows/:rowId/relations', async (c) => {
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  const relations = await adapter.getRelationsForRow(c.req.param('rowId'));
  return c.json(relations);
});

export { relationRoutes };
