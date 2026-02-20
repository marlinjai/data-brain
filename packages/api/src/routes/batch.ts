import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authMiddleware } from '../middleware/auth';
import { getAdapter, getWorkspaceId } from '../adapter';
import { batchRequestSchema } from '@data-brain/shared';
import type { BatchResult } from '@data-brain/shared';

const batchRoutes = new Hono<AppEnv>();
batchRoutes.use('*', authMiddleware);

batchRoutes.post('/rpc/batch', async (c) => {
  const { operations } = batchRequestSchema.parse(await c.req.json());
  const adapter = getAdapter(c);
  const workspaceId = getWorkspaceId(c);
  const results: BatchResult[] = [];

  for (const op of operations) {
    try {
      const params = { ...op.params };
      if (op.method === 'createTable') params.workspaceId = workspaceId;
      if (op.method === 'listTables') params.workspaceId = workspaceId;

      let data: unknown;
      switch (op.method) {
        case 'getTable':
        case 'deleteTable':
          data = await (adapter as any)[op.method](params.id ?? params.tableId);
          break;
        case 'getColumns':
        case 'getViews':
          data = await (adapter as any)[op.method](params.tableId);
          break;
        case 'getColumn':
        case 'deleteColumn':
          data = await (adapter as any)[op.method](params.id ?? params.columnId);
          break;
        case 'getRow':
        case 'deleteRow':
        case 'archiveRow':
        case 'unarchiveRow':
          data = await (adapter as any)[op.method](params.id ?? params.rowId);
          break;
        case 'getView':
        case 'deleteView':
          data = await (adapter as any)[op.method](params.id ?? params.viewId);
          break;
        case 'getSelectOptions':
          data = await (adapter as any)[op.method](params.columnId);
          break;
        case 'deleteSelectOption':
          data = await (adapter as any)[op.method](params.id ?? params.optionId);
          break;
        case 'removeFileReference':
          data = await (adapter as any)[op.method](params.id ?? params.fileRefId);
          break;
        case 'getRelationsForRow':
          data = await (adapter as any)[op.method](params.rowId);
          break;
        case 'createTable':
        case 'createColumn':
        case 'createRow':
        case 'createView':
        case 'createSelectOption':
        case 'createRelation':
        case 'addFileReference':
          data = await (adapter as any)[op.method](params);
          break;
        case 'updateTable':
        case 'updateColumn':
        case 'updateView':
        case 'updateSelectOption':
          data = await (adapter as any)[op.method](params.id, params.updates);
          break;
        case 'updateRow':
          data = await (adapter as any)[op.method](params.id, params.cells);
          break;
        case 'listTables':
          data = await adapter.listTables(params.workspaceId as string);
          break;
        case 'getRows':
          data = await adapter.getRows(params.tableId as string, params.query as any);
          break;
        case 'bulkCreateRows':
          data = await adapter.bulkCreateRows(params.inputs as any[]);
          break;
        case 'bulkDeleteRows':
        case 'bulkArchiveRows':
          data = await (adapter as any)[op.method](params.rowIds);
          break;
        case 'reorderColumns':
        case 'reorderViews':
          data = await (adapter as any)[op.method](params.tableId, params.ids);
          break;
        case 'reorderSelectOptions':
          data = await (adapter as any)[op.method](params.columnId, params.ids);
          break;
        case 'reorderFileReferences':
          data = await (adapter as any)[op.method](params.rowId, params.columnId, params.ids);
          break;
        case 'getRelatedRows':
          data = await adapter.getRelatedRows(params.rowId as string, params.columnId as string);
          break;
        case 'deleteRelation':
          data = await adapter.deleteRelation(params.sourceRowId as string, params.columnId as string, params.targetRowId as string);
          break;
        case 'getFileReferences':
          data = await adapter.getFileReferences(params.rowId as string, params.columnId as string);
          break;
        default:
          throw new Error(`Unknown batch method: ${op.method}`);
      }
      results.push({ success: true, data });
    } catch (err) {
      results.push({
        success: false,
        error: { code: 'OPERATION_FAILED', message: err instanceof Error ? err.message : 'Unknown error' },
      });
    }
  }

  return c.json({ results });
});

export { batchRoutes };
