import { describe, it, expect } from 'vitest';
import {
  createTableSchema,
  updateTableSchema,
  columnTypeSchema,
  createColumnSchema,
  updateColumnSchema,
  reorderIdsSchema,
  createRowSchema,
  updateRowCellsSchema,
  queryOptionsSchema,
  bulkRowIdsSchema,
  viewTypeSchema,
  createViewSchema,
  updateViewSchema,
  createSelectOptionSchema,
  updateSelectOptionSchema,
  createRelationSchema,
  deleteRelationSchema,
  createFileRefSchema,
  batchOperationSchema,
  batchRequestSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema,
  createTenantSchema,
} from './schemas';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

// ─── createTableSchema ──────────────────────────────────────────────────

describe('createTableSchema', () => {
  it('accepts valid input', () => {
    const result = createTableSchema.safeParse({ workspaceId: 'ws-1', name: 'Tasks' });
    expect(result.success).toBe(true);
  });

  it('accepts optional fields', () => {
    const result = createTableSchema.safeParse({
      workspaceId: 'ws-1',
      name: 'Tasks',
      description: 'A task table',
      icon: '📋',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty workspaceId', () => {
    const result = createTableSchema.safeParse({ workspaceId: '', name: 'Tasks' });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createTableSchema.safeParse({ workspaceId: 'ws-1', name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 255 chars', () => {
    const result = createTableSchema.safeParse({ workspaceId: 'ws-1', name: 'a'.repeat(256) });
    expect(result.success).toBe(false);
  });

  it('rejects description over 1000 chars', () => {
    const result = createTableSchema.safeParse({
      workspaceId: 'ws-1',
      name: 'T',
      description: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = createTableSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── updateTableSchema ──────────────────────────────────────────────────

describe('updateTableSchema', () => {
  it('accepts partial update', () => {
    expect(updateTableSchema.safeParse({ name: 'New name' }).success).toBe(true);
  });

  it('accepts empty object (no updates)', () => {
    expect(updateTableSchema.safeParse({}).success).toBe(true);
  });

  it('rejects invalid name', () => {
    expect(updateTableSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

// ─── columnTypeSchema ───────────────────────────────────────────────────

describe('columnTypeSchema', () => {
  it.each([
    'text', 'number', 'date', 'boolean', 'select', 'multi_select',
    'url', 'file', 'formula', 'relation', 'rollup', 'created_time', 'last_edited_time',
  ])('accepts "%s"', (type) => {
    expect(columnTypeSchema.safeParse(type).success).toBe(true);
  });

  it('rejects unknown type', () => {
    expect(columnTypeSchema.safeParse('unknown').success).toBe(false);
  });
});

// ─── createColumnSchema ─────────────────────────────────────────────────

describe('createColumnSchema', () => {
  it('accepts valid input', () => {
    const result = createColumnSchema.safeParse({
      tableId: UUID,
      name: 'Title',
      type: 'text',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional fields', () => {
    const result = createColumnSchema.safeParse({
      tableId: UUID,
      name: 'Status',
      type: 'select',
      position: 2,
      width: 200,
      isPrimary: true,
      config: { defaultValue: 'open' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-uuid tableId', () => {
    const result = createColumnSchema.safeParse({
      tableId: 'not-a-uuid',
      name: 'Title',
      type: 'text',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const result = createColumnSchema.safeParse({
      tableId: UUID,
      name: 'Foo',
      type: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative position', () => {
    const result = createColumnSchema.safeParse({
      tableId: UUID,
      name: 'Title',
      type: 'text',
      position: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero width', () => {
    const result = createColumnSchema.safeParse({
      tableId: UUID,
      name: 'Title',
      type: 'text',
      width: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ─── updateColumnSchema ─────────────────────────────────────────────────

describe('updateColumnSchema', () => {
  it('accepts partial update', () => {
    expect(updateColumnSchema.safeParse({ name: 'Renamed' }).success).toBe(true);
  });

  it('accepts empty object', () => {
    expect(updateColumnSchema.safeParse({}).success).toBe(true);
  });
});

// ─── reorderIdsSchema ───────────────────────────────────────────────────

describe('reorderIdsSchema', () => {
  it('accepts array of UUIDs', () => {
    expect(reorderIdsSchema.safeParse([UUID]).success).toBe(true);
  });

  it('rejects empty array', () => {
    expect(reorderIdsSchema.safeParse([]).success).toBe(false);
  });

  it('rejects non-uuid strings', () => {
    expect(reorderIdsSchema.safeParse(['not-uuid']).success).toBe(false);
  });
});

// ─── createRowSchema ────────────────────────────────────────────────────

describe('createRowSchema', () => {
  it('accepts valid input', () => {
    const result = createRowSchema.safeParse({ tableId: UUID });
    expect(result.success).toBe(true);
  });

  it('accepts optional cells and parentRowId', () => {
    const result = createRowSchema.safeParse({
      tableId: UUID,
      parentRowId: UUID,
      cells: { title: 'Hello' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-uuid tableId', () => {
    const result = createRowSchema.safeParse({ tableId: 'abc' });
    expect(result.success).toBe(false);
  });
});

// ─── updateRowCellsSchema ───────────────────────────────────────────────

describe('updateRowCellsSchema', () => {
  it('accepts any record', () => {
    expect(updateRowCellsSchema.safeParse({ foo: 'bar', num: 42 }).success).toBe(true);
  });

  it('accepts empty object', () => {
    expect(updateRowCellsSchema.safeParse({}).success).toBe(true);
  });
});

// ─── queryOptionsSchema ─────────────────────────────────────────────────

describe('queryOptionsSchema', () => {
  it('accepts undefined (optional)', () => {
    expect(queryOptionsSchema.safeParse(undefined).success).toBe(true);
  });

  it('accepts limit and offset', () => {
    const result = queryOptionsSchema.safeParse({ limit: 10, offset: 0 });
    expect(result.success).toBe(true);
  });

  it('coerces string limit to number', () => {
    const result = queryOptionsSchema.safeParse({ limit: '10' });
    expect(result.success).toBe(true);
    expect(result.data?.limit).toBe(10);
  });

  it('rejects limit over max', () => {
    const result = queryOptionsSchema.safeParse({ limit: 201 });
    expect(result.success).toBe(false);
  });

  it('rejects limit of 0', () => {
    const result = queryOptionsSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative offset', () => {
    const result = queryOptionsSchema.safeParse({ offset: -1 });
    expect(result.success).toBe(false);
  });

  it('accepts filters', () => {
    const result = queryOptionsSchema.safeParse({
      filters: [{ columnId: 'col-1', operator: 'equals', value: 'test' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid filter operator', () => {
    const result = queryOptionsSchema.safeParse({
      filters: [{ columnId: 'col-1', operator: 'invalidOp', value: 'x' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts sorts', () => {
    const result = queryOptionsSchema.safeParse({
      sorts: [{ columnId: 'col-1', direction: 'asc' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid sort direction', () => {
    const result = queryOptionsSchema.safeParse({
      sorts: [{ columnId: 'col-1', direction: 'up' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts parentRowId and includeSubItems', () => {
    const result = queryOptionsSchema.safeParse({
      parentRowId: UUID,
      includeSubItems: true,
    });
    expect(result.success).toBe(true);
  });
});

// ─── bulkRowIdsSchema ───────────────────────────────────────────────────

describe('bulkRowIdsSchema', () => {
  it('accepts 1 to 1000 UUIDs', () => {
    expect(bulkRowIdsSchema.safeParse([UUID]).success).toBe(true);
  });

  it('rejects empty array', () => {
    expect(bulkRowIdsSchema.safeParse([]).success).toBe(false);
  });

  it('rejects over 1000 items', () => {
    const ids = Array.from({ length: 1001 }, () => UUID);
    expect(bulkRowIdsSchema.safeParse(ids).success).toBe(false);
  });
});

// ─── viewTypeSchema ─────────────────────────────────────────────────────

describe('viewTypeSchema', () => {
  it.each(['table', 'board', 'calendar', 'gallery', 'timeline', 'list'])('accepts "%s"', (type) => {
    expect(viewTypeSchema.safeParse(type).success).toBe(true);
  });

  it('rejects unknown', () => {
    expect(viewTypeSchema.safeParse('spreadsheet').success).toBe(false);
  });
});

// ─── createViewSchema ───────────────────────────────────────────────────

describe('createViewSchema', () => {
  it('accepts valid input', () => {
    const result = createViewSchema.safeParse({
      tableId: UUID,
      name: 'Default View',
      type: 'table',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing type', () => {
    const result = createViewSchema.safeParse({ tableId: UUID, name: 'V' });
    expect(result.success).toBe(false);
  });
});

// ─── updateViewSchema ───────────────────────────────────────────────────

describe('updateViewSchema', () => {
  it('accepts partial update', () => {
    expect(updateViewSchema.safeParse({ name: 'New' }).success).toBe(true);
  });

  it('accepts empty object', () => {
    expect(updateViewSchema.safeParse({}).success).toBe(true);
  });
});

// ─── createSelectOptionSchema ───────────────────────────────────────────

describe('createSelectOptionSchema', () => {
  it('accepts valid input', () => {
    const result = createSelectOptionSchema.safeParse({
      columnId: UUID,
      name: 'Open',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional color and position', () => {
    const result = createSelectOptionSchema.safeParse({
      columnId: UUID,
      name: 'Open',
      color: '#ff0000',
      position: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createSelectOptionSchema.safeParse({ columnId: UUID, name: '' }).success).toBe(false);
  });
});

// ─── updateSelectOptionSchema ───────────────────────────────────────────

describe('updateSelectOptionSchema', () => {
  it('accepts partial update', () => {
    expect(updateSelectOptionSchema.safeParse({ color: 'blue' }).success).toBe(true);
  });
});

// ─── createRelationSchema ───────────────────────────────────────────────

describe('createRelationSchema', () => {
  it('accepts valid input', () => {
    const result = createRelationSchema.safeParse({
      sourceRowId: UUID,
      sourceColumnId: UUID,
      targetRowId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(createRelationSchema.safeParse({ sourceRowId: UUID }).success).toBe(false);
  });
});

// ─── deleteRelationSchema ───────────────────────────────────────────────

describe('deleteRelationSchema', () => {
  it('accepts valid input', () => {
    const result = deleteRelationSchema.safeParse({
      sourceRowId: UUID,
      columnId: UUID,
      targetRowId: UUID,
    });
    expect(result.success).toBe(true);
  });
});

// ─── createFileRefSchema ────────────────────────────────────────────────

describe('createFileRefSchema', () => {
  it('accepts valid input', () => {
    const result = createFileRefSchema.safeParse({
      rowId: UUID,
      columnId: UUID,
      fileId: 'file-123',
      fileUrl: 'https://example.com/file.pdf',
      originalName: 'report.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional fields', () => {
    const result = createFileRefSchema.safeParse({
      rowId: UUID,
      columnId: UUID,
      fileId: 'file-123',
      fileUrl: 'https://example.com/file.pdf',
      originalName: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      position: 0,
      metadata: { thumbnail: 'thumb.jpg' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL', () => {
    const result = createFileRefSchema.safeParse({
      rowId: UUID,
      columnId: UUID,
      fileId: 'file-123',
      fileUrl: 'not-a-url',
      originalName: 'report.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fileId', () => {
    const result = createFileRefSchema.safeParse({
      rowId: UUID,
      columnId: UUID,
      fileUrl: 'https://example.com/file.pdf',
      originalName: 'report.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.success).toBe(false);
  });
});

// ─── batchRequestSchema ─────────────────────────────────────────────────

describe('batchRequestSchema', () => {
  it('accepts valid batch', () => {
    const result = batchRequestSchema.safeParse({
      operations: [
        { method: 'createTable', params: { workspaceId: 'ws-1', name: 'T' } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty operations', () => {
    expect(batchRequestSchema.safeParse({ operations: [] }).success).toBe(false);
  });

  it('rejects over 50 operations', () => {
    const ops = Array.from({ length: 51 }, () => ({ method: 'getTable', params: { id: UUID } }));
    expect(batchRequestSchema.safeParse({ operations: ops }).success).toBe(false);
  });

  it('rejects invalid method', () => {
    const result = batchRequestSchema.safeParse({
      operations: [{ method: 'notAMethod', params: {} }],
    });
    expect(result.success).toBe(false);
  });
});

// ─── createWorkspaceSchema ──────────────────────────────────────────────

describe('createWorkspaceSchema', () => {
  it('accepts valid input', () => {
    const result = createWorkspaceSchema.safeParse({
      name: 'My Workspace',
      slug: 'my-workspace',
    });
    expect(result.success).toBe(true);
  });

  it('accepts single-char slug', () => {
    expect(createWorkspaceSchema.safeParse({ name: 'W', slug: 'w' }).success).toBe(true);
  });

  it('rejects slug with uppercase', () => {
    expect(createWorkspaceSchema.safeParse({ name: 'W', slug: 'MySlug' }).success).toBe(false);
  });

  it('rejects slug starting with hyphen', () => {
    expect(createWorkspaceSchema.safeParse({ name: 'W', slug: '-bad' }).success).toBe(false);
  });

  it('rejects slug ending with hyphen', () => {
    expect(createWorkspaceSchema.safeParse({ name: 'W', slug: 'bad-' }).success).toBe(false);
  });

  it('rejects empty name', () => {
    expect(createWorkspaceSchema.safeParse({ name: '', slug: 'ok' }).success).toBe(false);
  });
});

// ─── updateWorkspaceSchema ──────────────────────────────────────────────

describe('updateWorkspaceSchema', () => {
  it('accepts partial update', () => {
    expect(updateWorkspaceSchema.safeParse({ name: 'New' }).success).toBe(true);
  });

  it('accepts nullable quotaRows', () => {
    expect(updateWorkspaceSchema.safeParse({ quotaRows: null }).success).toBe(true);
  });

  it('accepts empty object', () => {
    expect(updateWorkspaceSchema.safeParse({}).success).toBe(true);
  });
});

// ─── createTenantSchema ─────────────────────────────────────────────────

describe('createTenantSchema', () => {
  it('accepts valid input', () => {
    expect(createTenantSchema.safeParse({ name: 'Acme' }).success).toBe(true);
  });

  it('accepts optional quotaRows and maxTables', () => {
    const result = createTenantSchema.safeParse({
      name: 'Acme',
      quotaRows: 500_000,
      maxTables: 200,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createTenantSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    expect(createTenantSchema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false);
  });

  it('rejects negative quotaRows', () => {
    expect(createTenantSchema.safeParse({ name: 'A', quotaRows: -1 }).success).toBe(false);
  });

  it('rejects zero maxTables', () => {
    expect(createTenantSchema.safeParse({ name: 'A', maxTables: 0 }).success).toBe(false);
  });
});
