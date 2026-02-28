import postgres from 'postgres';
import {
  BaseDatabaseAdapter,
  type Table,
  type Column,
  type Row,
  type SelectOption,
  type FileReference,
  type View,
  type ViewConfig,
  type QueryOptions,
  type QueryResult,
  type CreateTableInput,
  type CreateColumnInput,
  type CreateRowInput,
  type CreateSelectOptionInput,
  type CreateRelationInput,
  type CreateFileRefInput,
  type CreateViewInput,
  type UpdateTableInput,
  type UpdateColumnInput,
  type UpdateSelectOptionInput,
  type UpdateViewInput,
  type CellValue,
  type ColumnConfig,
  type DatabaseAdapter,
} from '@marlinjai/data-table-core';

export interface PostgresDataAdapterConfig {
  connectionString: string;
}

export class PostgresDataAdapter extends BaseDatabaseAdapter {
  private sql: postgres.Sql;

  constructor(config: PostgresDataAdapterConfig) {
    super();
    this.sql = postgres(config.connectionString);
  }

  /** Expose the underlying sql instance for use in transactions */
  getSql(): postgres.Sql {
    return this.sql;
  }

  /** Gracefully close the connection pool */
  async close(): Promise<void> {
    await this.sql.end();
  }

  // =========================================================================
  // Tables
  // =========================================================================

  async createTable(input: CreateTableInput): Promise<Table> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.sql`
      INSERT INTO dt_tables (id, workspace_id, name, description, icon, created_at, updated_at)
      VALUES (${id}, ${input.workspaceId}, ${input.name}, ${input.description ?? null}, ${input.icon ?? null}, ${now}, ${now})
    `;

    return {
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      icon: input.icon,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  async getTable(tableId: string): Promise<Table | null> {
    const rows = await this.sql`SELECT * FROM dt_tables WHERE id = ${tableId}`;
    const row = rows[0];
    return row ? this.mapTable(row) : null;
  }

  async updateTable(tableId: string, updates: UpdateTableInput): Promise<Table> {
    const now = new Date().toISOString();
    const sets: postgres.PendingQuery<postgres.Row[]>[] = [
      this.sql`updated_at = ${now}`,
    ];

    if (updates.name !== undefined) sets.push(this.sql`name = ${updates.name}`);
    if (updates.description !== undefined) sets.push(this.sql`description = ${updates.description ?? null}`);
    if (updates.icon !== undefined) sets.push(this.sql`icon = ${updates.icon ?? null}`);

    const setClause = sets.reduce((acc, s) => this.sql`${acc}, ${s}`);
    await this.sql`UPDATE dt_tables SET ${setClause} WHERE id = ${tableId}`;

    const table = await this.getTable(tableId);
    if (!table) throw new Error('Table not found after update');
    return table;
  }

  async deleteTable(tableId: string): Promise<void> {
    await this.sql`DELETE FROM dt_files WHERE row_id IN (SELECT id FROM dt_rows WHERE table_id = ${tableId})`;
    await this.sql`DELETE FROM dt_relations WHERE source_row_id IN (SELECT id FROM dt_rows WHERE table_id = ${tableId})`;
    await this.sql`DELETE FROM dt_rows WHERE table_id = ${tableId}`;
    await this.sql`DELETE FROM dt_select_options WHERE column_id IN (SELECT id FROM dt_columns WHERE table_id = ${tableId})`;
    await this.sql`DELETE FROM dt_columns WHERE table_id = ${tableId}`;
    await this.sql`DELETE FROM dt_views WHERE table_id = ${tableId}`;
    await this.sql`DELETE FROM dt_tables WHERE id = ${tableId}`;
  }

  async listTables(workspaceId: string): Promise<Table[]> {
    const rows = await this.sql`
      SELECT * FROM dt_tables WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC
    `;
    return rows.map((row) => this.mapTable(row));
  }

  // =========================================================================
  // Columns
  // =========================================================================

  async createColumn(input: CreateColumnInput): Promise<Column> {
    const id = this.generateId();
    const now = new Date().toISOString();

    let position: number;
    if (input.position !== undefined) {
      position = input.position;
    } else {
      const result = await this.sql`
        SELECT COALESCE(MAX(position), -1) as max_pos FROM dt_columns WHERE table_id = ${input.tableId}
      `;
      position = (result[0]?.max_pos ?? -1) + 1;
    }

    await this.sql`
      INSERT INTO dt_columns (id, table_id, name, type, position, width, is_primary, config, created_at)
      VALUES (${id}, ${input.tableId}, ${input.name}, ${input.type}, ${position}, ${input.width ?? 200}, ${input.isPrimary ? 1 : 0}, ${input.config ? JSON.stringify(input.config) : null}, ${now})
    `;

    return {
      id,
      tableId: input.tableId,
      name: input.name,
      type: input.type,
      position,
      width: input.width ?? 200,
      isPrimary: input.isPrimary ?? false,
      config: input.config,
      createdAt: new Date(now),
    };
  }

  async getColumns(tableId: string): Promise<Column[]> {
    const rows = await this.sql`
      SELECT * FROM dt_columns WHERE table_id = ${tableId} ORDER BY position ASC
    `;
    return rows.map((row) => this.mapColumn(row));
  }

  async getColumn(columnId: string): Promise<Column | null> {
    const rows = await this.sql`SELECT * FROM dt_columns WHERE id = ${columnId}`;
    const row = rows[0];
    return row ? this.mapColumn(row) : null;
  }

  async updateColumn(columnId: string, updates: UpdateColumnInput): Promise<Column> {
    const sets: postgres.PendingQuery<postgres.Row[]>[] = [];

    if (updates.name !== undefined) sets.push(this.sql`name = ${updates.name}`);
    if (updates.width !== undefined) sets.push(this.sql`width = ${updates.width}`);
    if (updates.config !== undefined) {
      sets.push(this.sql`config = ${updates.config ? JSON.stringify(updates.config) : null}`);
    }

    if (sets.length > 0) {
      const setClause = sets.reduce((acc, s) => this.sql`${acc}, ${s}`);
      await this.sql`UPDATE dt_columns SET ${setClause} WHERE id = ${columnId}`;
    }

    const column = await this.getColumn(columnId);
    if (!column) throw new Error('Column not found after update');
    return column;
  }

  async deleteColumn(columnId: string): Promise<void> {
    await this.sql`DELETE FROM dt_select_options WHERE column_id = ${columnId}`;
    await this.sql`DELETE FROM dt_files WHERE column_id = ${columnId}`;
    await this.sql`DELETE FROM dt_relations WHERE source_column_id = ${columnId}`;
    await this.sql`DELETE FROM dt_columns WHERE id = ${columnId}`;
  }

  async reorderColumns(tableId: string, columnIds: string[]): Promise<void> {
    for (let i = 0; i < columnIds.length; i++) {
      const columnId = columnIds[i]!;
      await this.sql`UPDATE dt_columns SET position = ${i} WHERE id = ${columnId} AND table_id = ${tableId}`;
    }
  }

  // =========================================================================
  // Select Options
  // =========================================================================

  async createSelectOption(input: CreateSelectOptionInput): Promise<SelectOption> {
    const id = this.generateId();

    let position: number;
    if (input.position !== undefined) {
      position = input.position;
    } else {
      const result = await this.sql`
        SELECT COALESCE(MAX(position), -1) as max_pos FROM dt_select_options WHERE column_id = ${input.columnId}
      `;
      position = (result[0]?.max_pos ?? -1) + 1;
    }

    await this.sql`
      INSERT INTO dt_select_options (id, column_id, name, color, position)
      VALUES (${id}, ${input.columnId}, ${input.name}, ${input.color ?? null}, ${position})
    `;

    return {
      id,
      columnId: input.columnId,
      name: input.name,
      color: input.color,
      position,
    };
  }

  async getSelectOptions(columnId: string): Promise<SelectOption[]> {
    const rows = await this.sql`
      SELECT * FROM dt_select_options WHERE column_id = ${columnId} ORDER BY position ASC
    `;
    return rows.map((row) => ({
      id: row.id as string,
      columnId: row.column_id as string,
      name: row.name as string,
      color: (row.color as string) ?? undefined,
      position: row.position as number,
    }));
  }

  async updateSelectOption(optionId: string, updates: UpdateSelectOptionInput): Promise<SelectOption> {
    const sets: postgres.PendingQuery<postgres.Row[]>[] = [];

    if (updates.name !== undefined) sets.push(this.sql`name = ${updates.name}`);
    if (updates.color !== undefined) sets.push(this.sql`color = ${updates.color ?? null}`);
    if (updates.position !== undefined) sets.push(this.sql`position = ${updates.position}`);

    if (sets.length > 0) {
      const setClause = sets.reduce((acc, s) => this.sql`${acc}, ${s}`);
      await this.sql`UPDATE dt_select_options SET ${setClause} WHERE id = ${optionId}`;
    }

    const rows = await this.sql`SELECT * FROM dt_select_options WHERE id = ${optionId}`;
    const result = rows[0];
    if (!result) throw new Error('Select option not found');

    return {
      id: result.id as string,
      columnId: result.column_id as string,
      name: result.name as string,
      color: (result.color as string) ?? undefined,
      position: result.position as number,
    };
  }

  async deleteSelectOption(optionId: string): Promise<void> {
    await this.sql`DELETE FROM dt_select_options WHERE id = ${optionId}`;
  }

  async reorderSelectOptions(columnId: string, optionIds: string[]): Promise<void> {
    for (let i = 0; i < optionIds.length; i++) {
      const optionId = optionIds[i]!;
      await this.sql`UPDATE dt_select_options SET position = ${i} WHERE id = ${optionId} AND column_id = ${columnId}`;
    }
  }

  // =========================================================================
  // Rows
  // =========================================================================

  async createRow(input: CreateRowInput): Promise<Row> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const cells = input.cells ?? {};

    await this.sql`
      INSERT INTO dt_rows (id, table_id, cells, computed, _title, _archived, _created_at, _updated_at)
      VALUES (${id}, ${input.tableId}, ${JSON.stringify(cells)}, ${null}, ${null}, ${0}, ${now}, ${now})
    `;

    return {
      id,
      tableId: input.tableId,
      cells,
      computed: {},
      archived: false,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  async getRow(rowId: string): Promise<Row | null> {
    const rows = await this.sql`SELECT * FROM dt_rows WHERE id = ${rowId}`;
    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async getRows(tableId: string, query?: QueryOptions): Promise<QueryResult<Row>> {
    // Build WHERE conditions
    const conditions: string[] = ['table_id = $1'];
    const params: (string | number | boolean)[] = [tableId];
    let paramIndex = 2;

    if (!query?.includeArchived) {
      conditions.push('_archived = 0');
    }

    if (query?.filters && query.filters.length > 0) {
      for (const filter of query.filters) {
        const { columnId, operator, value } = filter;
        // PostgreSQL JSONB syntax
        const jsonPath = `cells::jsonb->>'${columnId}'`;

        switch (operator) {
          case 'equals':
            conditions.push(`${jsonPath} = $${paramIndex}`);
            params.push(value as string | number);
            paramIndex++;
            break;
          case 'notEquals':
            conditions.push(`${jsonPath} != $${paramIndex}`);
            params.push(value as string | number);
            paramIndex++;
            break;
          case 'contains':
            conditions.push(`${jsonPath} ILIKE $${paramIndex}`);
            params.push(`%${value}%`);
            paramIndex++;
            break;
          case 'isEmpty':
            conditions.push(`(${jsonPath} IS NULL OR ${jsonPath} = '')`);
            break;
          case 'isNotEmpty':
            conditions.push(`${jsonPath} IS NOT NULL AND ${jsonPath} != ''`);
            break;
          case 'greaterThan':
            conditions.push(`(${jsonPath})::NUMERIC > $${paramIndex}`);
            params.push(value as number);
            paramIndex++;
            break;
          case 'lessThan':
            conditions.push(`(${jsonPath})::NUMERIC < $${paramIndex}`);
            params.push(value as number);
            paramIndex++;
            break;
        }
      }
    }

    // Build ORDER BY
    let orderBy = '_created_at DESC';
    if (query?.sorts && query.sorts.length > 0) {
      const sortClauses = query.sorts.map((sort) => {
        const jsonPath = `cells::jsonb->>'${sort.columnId}'`;
        return `${jsonPath} ${sort.direction.toUpperCase()}`;
      });
      orderBy = sortClauses.join(', ');
    }

    const whereClause = conditions.join(' AND ');
    const limit = query?.limit ?? 50;
    const offset = query?.offset ?? 0;

    // Get total count
    const countResult = await this.sql.unsafe(
      `SELECT COUNT(*)::int as count FROM dt_rows WHERE ${whereClause}`,
      params.slice(0, 1) // Only tableId for count
    );
    const total = countResult[0]?.count ?? 0;

    // Get rows
    const fullSql = `SELECT * FROM dt_rows WHERE ${whereClause} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`;
    const result = await this.sql.unsafe(fullSql, params);

    const items = result.map((row) => this.mapRow(row));

    return {
      items,
      total,
      hasMore: offset + items.length < total,
      cursor: offset + items.length < total ? String(offset + limit) : undefined,
    };
  }

  async updateRow(rowId: string, cells: Record<string, CellValue>): Promise<Row> {
    const now = new Date().toISOString();

    const existing = await this.getRow(rowId);
    if (!existing) throw new Error('Row not found');

    const mergedCells = { ...existing.cells, ...cells };

    await this.sql`
      UPDATE dt_rows SET cells = ${JSON.stringify(mergedCells)}, _updated_at = ${now} WHERE id = ${rowId}
    `;

    return {
      ...existing,
      cells: mergedCells,
      updatedAt: new Date(now),
    };
  }

  async deleteRow(rowId: string): Promise<void> {
    await this.sql`DELETE FROM dt_files WHERE row_id = ${rowId}`;
    await this.sql`DELETE FROM dt_relations WHERE source_row_id = ${rowId} OR target_row_id = ${rowId}`;
    await this.sql`DELETE FROM dt_rows WHERE id = ${rowId}`;
  }

  async archiveRow(rowId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.sql`UPDATE dt_rows SET _archived = 1, _updated_at = ${now} WHERE id = ${rowId}`;
  }

  async unarchiveRow(rowId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.sql`UPDATE dt_rows SET _archived = 0, _updated_at = ${now} WHERE id = ${rowId}`;
  }

  async bulkCreateRows(inputs: CreateRowInput[]): Promise<Row[]> {
    const now = new Date().toISOString();
    const rows: Row[] = [];

    for (const input of inputs) {
      const id = this.generateId();
      const cells = input.cells ?? {};
      await this.sql`
        INSERT INTO dt_rows (id, table_id, cells, computed, _title, _archived, _created_at, _updated_at)
        VALUES (${id}, ${input.tableId}, ${JSON.stringify(cells)}, ${null}, ${null}, ${0}, ${now}, ${now})
      `;
      rows.push({
        id,
        tableId: input.tableId,
        cells,
        computed: {},
        archived: false,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
    }

    return rows;
  }

  async bulkDeleteRows(rowIds: string[]): Promise<void> {
    if (rowIds.length === 0) return;

    await this.sql`DELETE FROM dt_files WHERE row_id = ANY(${rowIds})`;
    await this.sql`DELETE FROM dt_relations WHERE source_row_id = ANY(${rowIds}) OR target_row_id = ANY(${rowIds})`;
    await this.sql`DELETE FROM dt_rows WHERE id = ANY(${rowIds})`;
  }

  async bulkArchiveRows(rowIds: string[]): Promise<void> {
    if (rowIds.length === 0) return;
    const now = new Date().toISOString();
    await this.sql`UPDATE dt_rows SET _archived = 1, _updated_at = ${now} WHERE id = ANY(${rowIds})`;
  }

  // =========================================================================
  // Relations
  // =========================================================================

  async createRelation(input: CreateRelationInput): Promise<void> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.sql`
      INSERT INTO dt_relations (id, source_row_id, source_column_id, target_row_id, created_at)
      VALUES (${id}, ${input.sourceRowId}, ${input.sourceColumnId}, ${input.targetRowId}, ${now})
      ON CONFLICT (source_row_id, source_column_id, target_row_id) DO NOTHING
    `;
  }

  async deleteRelation(sourceRowId: string, columnId: string, targetRowId: string): Promise<void> {
    await this.sql`
      DELETE FROM dt_relations
      WHERE source_row_id = ${sourceRowId} AND source_column_id = ${columnId} AND target_row_id = ${targetRowId}
    `;
  }

  async getRelatedRows(rowId: string, columnId: string): Promise<Row[]> {
    const relations = await this.sql`
      SELECT target_row_id FROM dt_relations
      WHERE source_row_id = ${rowId} AND source_column_id = ${columnId}
    `;

    if (relations.length === 0) return [];

    const targetIds = relations.map((r) => r.target_row_id as string);
    const rows = await this.sql`SELECT * FROM dt_rows WHERE id = ANY(${targetIds})`;
    return rows.map((row) => this.mapRow(row));
  }

  async getRelationsForRow(rowId: string): Promise<Array<{ columnId: string; targetRowId: string }>> {
    const result = await this.sql`
      SELECT source_column_id, target_row_id FROM dt_relations WHERE source_row_id = ${rowId}
    `;

    return result.map((r) => ({
      columnId: r.source_column_id as string,
      targetRowId: r.target_row_id as string,
    }));
  }

  // =========================================================================
  // File References
  // =========================================================================

  async addFileReference(input: CreateFileRefInput): Promise<FileReference> {
    const id = this.generateId();

    let position: number;
    if (input.position !== undefined) {
      position = input.position;
    } else {
      const result = await this.sql`
        SELECT COALESCE(MAX(position), -1) as max_pos FROM dt_files WHERE row_id = ${input.rowId} AND column_id = ${input.columnId}
      `;
      position = (result[0]?.max_pos ?? -1) + 1;
    }

    await this.sql`
      INSERT INTO dt_files (id, row_id, column_id, file_id, file_url, original_name, file_type, size_bytes, position, metadata)
      VALUES (${id}, ${input.rowId}, ${input.columnId}, ${input.fileId}, ${input.fileUrl}, ${input.originalName}, ${input.mimeType}, ${input.sizeBytes ?? null}, ${position}, ${input.metadata ? JSON.stringify(input.metadata) : null})
    `;

    return {
      id,
      rowId: input.rowId,
      columnId: input.columnId,
      fileId: input.fileId,
      fileUrl: input.fileUrl,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      position,
      metadata: input.metadata,
    };
  }

  async removeFileReference(fileRefId: string): Promise<void> {
    await this.sql`DELETE FROM dt_files WHERE id = ${fileRefId}`;
  }

  async getFileReferences(rowId: string, columnId: string): Promise<FileReference[]> {
    const rows = await this.sql`
      SELECT * FROM dt_files WHERE row_id = ${rowId} AND column_id = ${columnId} ORDER BY position ASC
    `;

    return rows.map((row) => ({
      id: row.id as string,
      rowId: row.row_id as string,
      columnId: row.column_id as string,
      fileId: row.file_id as string,
      fileUrl: row.file_url as string,
      originalName: row.original_name as string,
      mimeType: row.file_type as string,
      sizeBytes: row.size_bytes != null ? (row.size_bytes as number) : undefined,
      position: row.position as number,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    }));
  }

  async reorderFileReferences(rowId: string, columnId: string, fileRefIds: string[]): Promise<void> {
    for (let i = 0; i < fileRefIds.length; i++) {
      const fileRefId = fileRefIds[i]!;
      await this.sql`UPDATE dt_files SET position = ${i} WHERE id = ${fileRefId} AND row_id = ${rowId} AND column_id = ${columnId}`;
    }
  }

  // =========================================================================
  // Views
  // =========================================================================

  async createView(input: CreateViewInput): Promise<View> {
    const id = this.generateId();
    const now = new Date().toISOString();

    let position: number;
    if (input.position !== undefined) {
      position = input.position;
    } else {
      const result = await this.sql`
        SELECT COALESCE(MAX(position), -1) as max_pos FROM dt_views WHERE table_id = ${input.tableId}
      `;
      position = (result[0]?.max_pos ?? -1) + 1;
    }

    const countResult = await this.sql`SELECT COUNT(*)::int as count FROM dt_views WHERE table_id = ${input.tableId}`;
    const isFirstView = (countResult[0]?.count ?? 0) === 0;
    const isDefault = input.isDefault ?? isFirstView;

    if (isDefault) {
      await this.sql`
        UPDATE dt_views SET is_default = 0, updated_at = ${now} WHERE table_id = ${input.tableId} AND is_default = 1
      `;
    }

    await this.sql`
      INSERT INTO dt_views (id, table_id, name, type, is_default, position, config, created_at, updated_at)
      VALUES (${id}, ${input.tableId}, ${input.name}, ${input.type}, ${isDefault ? 1 : 0}, ${position}, ${input.config ? JSON.stringify(input.config) : null}, ${now}, ${now})
    `;

    return {
      id,
      tableId: input.tableId,
      name: input.name,
      type: input.type,
      isDefault,
      position,
      config: input.config ?? {},
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  async getViews(tableId: string): Promise<View[]> {
    const rows = await this.sql`
      SELECT * FROM dt_views WHERE table_id = ${tableId} ORDER BY position ASC
    `;
    return rows.map((row) => this.mapView(row));
  }

  async getView(viewId: string): Promise<View | null> {
    const rows = await this.sql`SELECT * FROM dt_views WHERE id = ${viewId}`;
    const row = rows[0];
    return row ? this.mapView(row) : null;
  }

  async updateView(viewId: string, updates: UpdateViewInput): Promise<View> {
    const now = new Date().toISOString();
    const existing = await this.getView(viewId);
    if (!existing) throw new Error('View not found');

    const sets: postgres.PendingQuery<postgres.Row[]>[] = [
      this.sql`updated_at = ${now}`,
    ];

    if (updates.name !== undefined) sets.push(this.sql`name = ${updates.name}`);
    if (updates.type !== undefined) sets.push(this.sql`type = ${updates.type}`);
    if (updates.isDefault !== undefined) {
      sets.push(this.sql`is_default = ${updates.isDefault ? 1 : 0}`);
      if (updates.isDefault) {
        await this.sql`
          UPDATE dt_views SET is_default = 0, updated_at = ${now} WHERE table_id = ${existing.tableId} AND id != ${viewId}
        `;
      }
    }
    if (updates.config !== undefined) {
      const mergedConfig = updates.config ? { ...existing.config, ...updates.config } : null;
      sets.push(this.sql`config = ${mergedConfig ? JSON.stringify(mergedConfig) : null}`);
    }

    const setClause = sets.reduce((acc, s) => this.sql`${acc}, ${s}`);
    await this.sql`UPDATE dt_views SET ${setClause} WHERE id = ${viewId}`;

    const view = await this.getView(viewId);
    if (!view) throw new Error('View not found after update');
    return view;
  }

  async deleteView(viewId: string): Promise<void> {
    const view = await this.getView(viewId);
    if (!view) return;

    await this.sql`DELETE FROM dt_views WHERE id = ${viewId}`;

    if (view.isDefault) {
      const now = new Date().toISOString();
      await this.sql`
        UPDATE dt_views SET is_default = 1, updated_at = ${now}
        WHERE table_id = ${view.tableId} AND id = (SELECT id FROM dt_views WHERE table_id = ${view.tableId} ORDER BY position ASC LIMIT 1)
      `;
    }
  }

  async reorderViews(tableId: string, viewIds: string[]): Promise<void> {
    for (let i = 0; i < viewIds.length; i++) {
      const viewId = viewIds[i]!;
      await this.sql`UPDATE dt_views SET position = ${i} WHERE id = ${viewId} AND table_id = ${tableId}`;
    }
  }

  // =========================================================================
  // Transactions
  // =========================================================================

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    // For complex transactions, run directly (Postgres handles isolation)
    return fn(this);
  }

  // =========================================================================
  // Mappers
  // =========================================================================

  private mapTable(row: postgres.Row): Table {
    return {
      id: row.id as string,
      workspaceId: row.workspace_id as string,
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      icon: (row.icon as string) ?? undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapColumn(row: postgres.Row): Column {
    return {
      id: row.id as string,
      tableId: row.table_id as string,
      name: row.name as string,
      type: row.type as Column['type'],
      position: row.position as number,
      width: row.width as number,
      isPrimary: row.is_primary === 1 || row.is_primary === true,
      config: row.config ? (JSON.parse(row.config as string) as ColumnConfig) : undefined,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapRow(row: postgres.Row): Row {
    const cells = typeof row.cells === 'string' ? JSON.parse(row.cells) : row.cells;
    const computed = row.computed
      ? (typeof row.computed === 'string' ? JSON.parse(row.computed) : row.computed)
      : {};
    return {
      id: row.id as string,
      tableId: row.table_id as string,
      cells: cells as Record<string, CellValue>,
      computed: computed as Record<string, CellValue>,
      archived: row._archived === 1 || row._archived === true,
      createdAt: new Date(row._created_at as string),
      updatedAt: new Date(row._updated_at as string),
    };
  }

  private mapView(row: postgres.Row): View {
    return {
      id: row.id as string,
      tableId: row.table_id as string,
      name: row.name as string,
      type: row.type as View['type'],
      isDefault: row.is_default === 1 || row.is_default === true,
      position: row.position as number,
      config: row.config ? (JSON.parse(row.config as string) as ViewConfig) : {},
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
