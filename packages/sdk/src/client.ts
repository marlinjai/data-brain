import type {
  Table, Column, Row, View, SelectOption, FileReference,
  CreateTableInput, UpdateTableInput,
  CreateColumnInput, UpdateColumnInput,
  CreateRowInput, QueryOptions, QueryResult,
  CreateViewInput, UpdateViewInput,
  CreateSelectOptionInput, UpdateSelectOptionInput,
  CreateRelationInput, CreateFileRefInput,
  CellValue,
} from '@marlinjai/data-table-core';
import type { DataBrainConfig, TenantInfo, BatchOperation, BatchResult } from './types';
import { DataBrainError, NetworkError, parseApiError } from './errors';
import { RETRY_CONFIG } from './constants';

const DEFAULT_BASE_URL = 'https://data-brain-api.marlin-pohl.workers.dev';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;

export class DataBrain {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(config: DataBrainConfig) {
    if (!config.apiKey) throw new DataBrainError('API key is required', 'CONFIGURATION_ERROR');
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  // ─── Tables ──────────────────────────────────────────────────────────────

  async createTable(input: CreateTableInput): Promise<Table> {
    return this.request<Table>('POST', '/api/v1/tables', input);
  }

  async getTable(tableId: string): Promise<Table | null> {
    try {
      return await this.request<Table>('GET', `/api/v1/tables/${tableId}`);
    } catch (err) {
      if (err instanceof DataBrainError && err.statusCode === 404) return null;
      throw err;
    }
  }

  async updateTable(tableId: string, updates: UpdateTableInput): Promise<Table> {
    return this.request<Table>('PATCH', `/api/v1/tables/${tableId}`, updates);
  }

  async deleteTable(tableId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/tables/${tableId}`);
  }

  async listTables(_workspaceId: string): Promise<Table[]> {
    return this.request<Table[]>('GET', `/api/v1/tables`);
  }

  // ─── Columns ─────────────────────────────────────────────────────────────

  async createColumn(input: CreateColumnInput): Promise<Column> {
    return this.request<Column>('POST', `/api/v1/tables/${input.tableId}/columns`, input);
  }

  async getColumns(tableId: string): Promise<Column[]> {
    return this.request<Column[]>('GET', `/api/v1/tables/${tableId}/columns`);
  }

  async getColumn(columnId: string): Promise<Column | null> {
    try {
      return await this.request<Column>('GET', `/api/v1/columns/${columnId}`);
    } catch (err) {
      if (err instanceof DataBrainError && err.statusCode === 404) return null;
      throw err;
    }
  }

  async updateColumn(columnId: string, updates: UpdateColumnInput): Promise<Column> {
    return this.request<Column>('PATCH', `/api/v1/columns/${columnId}`, updates);
  }

  async deleteColumn(columnId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/columns/${columnId}`);
  }

  async reorderColumns(tableId: string, columnIds: string[]): Promise<void> {
    await this.request('PUT', `/api/v1/tables/${tableId}/columns/reorder`, columnIds);
  }

  // ─── Rows ────────────────────────────────────────────────────────────────

  async createRow(input: CreateRowInput): Promise<Row> {
    return this.request<Row>('POST', `/api/v1/tables/${input.tableId}/rows`, input);
  }

  async getRow(rowId: string): Promise<Row | null> {
    try {
      return await this.request<Row>('GET', `/api/v1/rows/${rowId}`);
    } catch (err) {
      if (err instanceof DataBrainError && err.statusCode === 404) return null;
      throw err;
    }
  }

  async getRows(tableId: string, query?: QueryOptions): Promise<QueryResult<Row>> {
    const params = new URLSearchParams();
    if (query) {
      if (query.limit) params.set('limit', String(query.limit));
      if (query.offset) params.set('offset', String(query.offset));
      if (query.cursor) params.set('cursor', query.cursor);
      if (query.includeArchived) params.set('includeArchived', 'true');
      // parentRowId & includeSubItems are available in data-table-core >=0.2
      const q = query as Record<string, unknown>;
      if (q.parentRowId !== undefined) params.set('parentRowId', String(q.parentRowId));
      if (q.includeSubItems) params.set('includeSubItems', 'true');
      if (query.filters?.length) params.set('filters', JSON.stringify(query.filters));
      if (query.sorts?.length) params.set('sorts', JSON.stringify(query.sorts));
    }
    const qs = params.toString();
    const path = qs ? `/api/v1/tables/${tableId}/rows?${qs}` : `/api/v1/tables/${tableId}/rows`;
    return this.request<QueryResult<Row>>('GET', path);
  }

  async updateRow(rowId: string, cells: Record<string, CellValue>): Promise<Row> {
    return this.request<Row>('PATCH', `/api/v1/rows/${rowId}`, cells);
  }

  async deleteRow(rowId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/rows/${rowId}`);
  }

  async archiveRow(rowId: string): Promise<void> {
    await this.request('POST', `/api/v1/rows/${rowId}/archive`);
  }

  async unarchiveRow(rowId: string): Promise<void> {
    await this.request('POST', `/api/v1/rows/${rowId}/unarchive`);
  }

  async bulkCreateRows(inputs: CreateRowInput[]): Promise<Row[]> {
    if (inputs.length === 0) return [];
    const tableId = inputs[0]!.tableId;
    return this.request<Row[]>('POST', `/api/v1/tables/${tableId}/rows/bulk`, inputs);
  }

  async bulkDeleteRows(rowIds: string[]): Promise<void> {
    await this.request('DELETE', '/api/v1/rows/bulk', rowIds);
  }

  async bulkArchiveRows(rowIds: string[]): Promise<void> {
    await this.request('POST', '/api/v1/rows/bulk/archive', rowIds);
  }

  // ─── Views ───────────────────────────────────────────────────────────────

  async createView(input: CreateViewInput): Promise<View> {
    return this.request<View>('POST', `/api/v1/tables/${input.tableId}/views`, input);
  }

  async getViews(tableId: string): Promise<View[]> {
    return this.request<View[]>('GET', `/api/v1/tables/${tableId}/views`);
  }

  async getView(viewId: string): Promise<View | null> {
    try {
      return await this.request<View>('GET', `/api/v1/views/${viewId}`);
    } catch (err) {
      if (err instanceof DataBrainError && err.statusCode === 404) return null;
      throw err;
    }
  }

  async updateView(viewId: string, updates: UpdateViewInput): Promise<View> {
    return this.request<View>('PATCH', `/api/v1/views/${viewId}`, updates);
  }

  async deleteView(viewId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/views/${viewId}`);
  }

  async reorderViews(tableId: string, viewIds: string[]): Promise<void> {
    await this.request('PUT', `/api/v1/tables/${tableId}/views/reorder`, viewIds);
  }

  // ─── Select Options ────────────────────────────────────────────────────

  async createSelectOption(input: CreateSelectOptionInput): Promise<SelectOption> {
    return this.request<SelectOption>('POST', `/api/v1/columns/${input.columnId}/options`, input);
  }

  async getSelectOptions(columnId: string): Promise<SelectOption[]> {
    return this.request<SelectOption[]>('GET', `/api/v1/columns/${columnId}/options`);
  }

  async updateSelectOption(optionId: string, updates: UpdateSelectOptionInput): Promise<SelectOption> {
    return this.request<SelectOption>('PATCH', `/api/v1/options/${optionId}`, updates);
  }

  async deleteSelectOption(optionId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/options/${optionId}`);
  }

  async reorderSelectOptions(columnId: string, optionIds: string[]): Promise<void> {
    await this.request('PUT', `/api/v1/columns/${columnId}/options/reorder`, optionIds);
  }

  // ─── Relations ───────────────────────────────────────────────────────────

  async createRelation(input: CreateRelationInput): Promise<void> {
    await this.request('POST', '/api/v1/relations', input);
  }

  async deleteRelation(sourceRowId: string, columnId: string, targetRowId: string): Promise<void> {
    await this.request('DELETE', '/api/v1/relations', { sourceRowId, columnId, targetRowId });
  }

  async getRelatedRows(rowId: string, columnId: string): Promise<Row[]> {
    return this.request<Row[]>('GET', `/api/v1/rows/${rowId}/relations/${columnId}`);
  }

  async getRelationsForRow(rowId: string): Promise<Array<{ columnId: string; targetRowId: string }>> {
    return this.request<Array<{ columnId: string; targetRowId: string }>>('GET', `/api/v1/rows/${rowId}/relations`);
  }

  // ─── File References ─────────────────────────────────────────────────────

  async addFileReference(input: CreateFileRefInput): Promise<FileReference> {
    return this.request<FileReference>('POST', '/api/v1/file-refs', input);
  }

  async removeFileReference(fileRefId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/file-refs/${fileRefId}`);
  }

  async getFileReferences(rowId: string, columnId: string): Promise<FileReference[]> {
    return this.request<FileReference[]>('GET', `/api/v1/rows/${rowId}/files/${columnId}`);
  }

  async reorderFileReferences(rowId: string, columnId: string, fileRefIds: string[]): Promise<void> {
    await this.request('PUT', `/api/v1/rows/${rowId}/files/${columnId}/reorder`, fileRefIds);
  }

  // ─── Batch ───────────────────────────────────────────────────────────────

  async batch(operations: BatchOperation[]): Promise<BatchResult[]> {
    const response = await this.request<{ results: BatchResult[] }>('POST', '/api/v1/rpc/batch', { operations });
    return response.results;
  }

  // ─── Tenant ──────────────────────────────────────────────────────────────

  async getTenantInfo(): Promise<TenantInfo> {
    return this.request<TenantInfo>('GET', '/api/v1/tenant/info');
  }

  // ─── HTTP Layer ──────────────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw parseApiError(response.status, errorBody as { error?: { code?: string; message?: string; details?: Record<string, unknown> } });
        }

        if (response.status === 204) return undefined as T;
        return await response.json() as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (error instanceof DataBrainError && error.statusCode && error.statusCode < 500) throw error;
        if (attempt < this.maxRetries - 1) {
          const delay = Math.min(
            RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
            RETRY_CONFIG.maxDelayMs
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new NetworkError(`Request failed after ${this.maxRetries} attempts`, lastError);
  }
}

export default DataBrain;
