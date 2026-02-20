import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from './error-handler';
import { getWorkspaceId } from '../adapter';
import type { D1Adapter } from '@marlinjai/data-table-adapter-d1';

export async function verifyTableOwnership(c: Context<AppEnv>, adapter: D1Adapter, tableId: string) {
  const table = await adapter.getTable(tableId);
  if (!table || table.workspaceId !== getWorkspaceId(c)) throw ApiError.notFound('Table not found');
  return table;
}

export async function verifyRowOwnership(c: Context<AppEnv>, adapter: D1Adapter, rowId: string) {
  const row = await adapter.getRow(rowId);
  if (!row) throw ApiError.notFound('Row not found');
  await verifyTableOwnership(c, adapter, row.tableId);
  return row;
}

export async function verifyColumnOwnership(c: Context<AppEnv>, adapter: D1Adapter, columnId: string) {
  const column = await adapter.getColumn(columnId);
  if (!column) throw ApiError.notFound('Column not found');
  await verifyTableOwnership(c, adapter, column.tableId);
  return column;
}
