import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { getAdapter } from '../adapter';
import { verifyTableOwnership, verifyRowOwnership } from '../middleware/ownership';
import { createRowSchema, updateRowCellsSchema, queryOptionsSchema, bulkRowIdsSchema } from '@data-brain/shared';
import type { QueryOptions } from '@marlinjai/data-table-core';

const rowRoutes = new Hono<AppEnv>();
rowRoutes.use('*', authMiddleware);

// GET /api/v1/tables/:tableId/rows
rowRoutes.get('/tables/:tableId/rows', async (c) => {
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  const url = new URL(c.req.url);
  const rawQuery: Record<string, unknown> = {};
  if (url.searchParams.has('limit')) rawQuery.limit = url.searchParams.get('limit');
  if (url.searchParams.has('offset')) rawQuery.offset = url.searchParams.get('offset');
  if (url.searchParams.has('cursor')) rawQuery.cursor = url.searchParams.get('cursor');
  if (url.searchParams.has('includeArchived')) rawQuery.includeArchived = url.searchParams.get('includeArchived');
  if (url.searchParams.has('parentRowId')) rawQuery.parentRowId = url.searchParams.get('parentRowId');
  if (url.searchParams.has('includeSubItems')) rawQuery.includeSubItems = url.searchParams.get('includeSubItems');
  if (url.searchParams.has('filters')) {
    try { rawQuery.filters = JSON.parse(url.searchParams.get('filters')!); }
    catch { throw ApiError.badRequest('Invalid JSON in filters parameter'); }
  }
  if (url.searchParams.has('sorts')) {
    try { rawQuery.sorts = JSON.parse(url.searchParams.get('sorts')!); }
    catch { throw ApiError.badRequest('Invalid JSON in sorts parameter'); }
  }
  const query = queryOptionsSchema.parse(Object.keys(rawQuery).length > 0 ? rawQuery : undefined);
  const result = await adapter.getRows(c.req.param('tableId'), query as QueryOptions);
  return c.json(result);
});

// POST /api/v1/tables/:tableId/rows
rowRoutes.post('/tables/:tableId/rows', async (c) => {
  const body = createRowSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  const row = await adapter.createRow({ ...body, tableId: c.req.param('tableId') });
  return c.json(row, 201);
});

// GET /api/v1/rows/:rowId
rowRoutes.get('/rows/:rowId', async (c) => {
  const adapter = getAdapter(c);
  const row = await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  return c.json(row);
});

// PATCH /api/v1/rows/:rowId
rowRoutes.patch('/rows/:rowId', async (c) => {
  const cells = updateRowCellsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  const row = await adapter.updateRow(c.req.param('rowId'), cells);
  return c.json(row);
});

// DELETE /api/v1/rows/:rowId
rowRoutes.delete('/rows/:rowId', async (c) => {
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  await adapter.deleteRow(c.req.param('rowId'));
  return c.json({ success: true });
});

// POST /api/v1/rows/:rowId/archive
rowRoutes.post('/rows/:rowId/archive', async (c) => {
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  await adapter.archiveRow(c.req.param('rowId'));
  return c.json({ success: true });
});

// POST /api/v1/rows/:rowId/unarchive
rowRoutes.post('/rows/:rowId/unarchive', async (c) => {
  const adapter = getAdapter(c);
  await verifyRowOwnership(c, adapter, c.req.param('rowId'));
  await adapter.unarchiveRow(c.req.param('rowId'));
  return c.json({ success: true });
});

// POST /api/v1/tables/:tableId/rows/bulk
rowRoutes.post('/tables/:tableId/rows/bulk', async (c) => {
  const rawInputs = z.array(z.object({
    cells: z.record(z.unknown()).optional(),
    parentRowId: z.string().uuid().optional(),
  })).min(1).max(1000).parse(await c.req.json());
  const adapter = getAdapter(c);
  await verifyTableOwnership(c, adapter, c.req.param('tableId'));
  const fullInputs = rawInputs.map((input) => ({ tableId: c.req.param('tableId'), ...input }));
  const rows = await adapter.bulkCreateRows(fullInputs);
  return c.json(rows, 201);
});

// DELETE /api/v1/rows/bulk
rowRoutes.delete('/rows/bulk', async (c) => {
  const rowIds = bulkRowIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  // Verify all rows belong to tables owned by this tenant
  for (const rowId of rowIds) {
    await verifyRowOwnership(c, adapter, rowId);
  }
  await adapter.bulkDeleteRows(rowIds);
  return c.json({ success: true });
});

// POST /api/v1/rows/bulk/archive
rowRoutes.post('/rows/bulk/archive', async (c) => {
  const rowIds = bulkRowIdsSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  // Verify all rows belong to tables owned by this tenant
  for (const rowId of rowIds) {
    await verifyRowOwnership(c, adapter, rowId);
  }
  await adapter.bulkArchiveRows(rowIds);
  return c.json({ success: true });
});

export { rowRoutes };
