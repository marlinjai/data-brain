import { z } from 'zod';
import { BATCH_METHODS, MAX_PAGE_LIMIT } from './constants';

// Re-export shared schemas from brain-core
export { uuidSchema, apiKeySchema, cursorSchema, workspaceSlugSchema } from '@marlinjai/brain-core';
// Import cursorSchema locally for use in queryOptionsSchema
import { cursorSchema } from '@marlinjai/brain-core';

export const createTableSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  icon: z.string().max(50).optional(),
});

export const updateTableSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  icon: z.string().max(50).optional(),
});

export const columnTypeSchema = z.enum([
  'text', 'number', 'date', 'boolean', 'select', 'multi_select',
  'url', 'file', 'formula', 'relation', 'rollup', 'created_time', 'last_edited_time',
]);

export const createColumnSchema = z.object({
  tableId: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: columnTypeSchema,
  position: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  isPrimary: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  width: z.number().int().positive().optional(),
  config: z.record(z.unknown()).optional(),
});

export const reorderIdsSchema = z.array(z.string().uuid()).min(1);

export const createRowSchema = z.object({
  tableId: z.string().uuid(),
  parentRowId: z.string().uuid().optional(),
  cells: z.record(z.unknown()).optional(),
});

export const updateRowCellsSchema = z.record(z.unknown());

export const queryOptionsSchema = z.object({
  filters: z.array(z.object({
    columnId: z.string(),
    operator: z.enum([
      'equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith',
      'greaterThan', 'greaterThanOrEquals', 'lessThan', 'lessThanOrEquals',
      'isEmpty', 'isNotEmpty', 'isIn', 'isNotIn',
    ]),
    value: z.unknown(),
  })).optional(),
  sorts: z.array(z.object({
    columnId: z.string(),
    direction: z.enum(['asc', 'desc']),
  })).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  cursor: cursorSchema,
  includeArchived: z.coerce.boolean().optional(),
  parentRowId: z.string().uuid().nullable().optional(),
  includeSubItems: z.coerce.boolean().optional(),
}).optional();

export const bulkRowIdsSchema = z.array(z.string().uuid()).min(1).max(1000);

export const viewTypeSchema = z.enum([
  'table', 'board', 'calendar', 'gallery', 'timeline', 'list',
]);

export const createViewSchema = z.object({
  tableId: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: viewTypeSchema,
  isDefault: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateViewSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: viewTypeSchema.optional(),
  isDefault: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

export const createSelectOptionSchema = z.object({
  columnId: z.string().uuid(),
  name: z.string().min(1).max(255),
  color: z.string().max(50).optional(),
  position: z.number().int().nonnegative().optional(),
});

export const updateSelectOptionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z.string().max(50).optional(),
  position: z.number().int().nonnegative().optional(),
});

export const createRelationSchema = z.object({
  sourceRowId: z.string().uuid(),
  sourceColumnId: z.string().uuid(),
  targetRowId: z.string().uuid(),
});

export const deleteRelationSchema = z.object({
  sourceRowId: z.string().uuid(),
  columnId: z.string().uuid(),
  targetRowId: z.string().uuid(),
});

export const createFileRefSchema = z.object({
  rowId: z.string().uuid(),
  columnId: z.string().uuid(),
  fileId: z.string().min(1),
  fileUrl: z.string().url(),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().nonnegative().optional(),
  position: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const batchOperationSchema = z.object({
  method: z.enum(BATCH_METHODS as unknown as [string, ...string[]]),
  params: z.record(z.unknown()),
});

export const batchRequestSchema = z.object({
  operations: z.array(batchOperationSchema).min(1).max(50),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, 'Slug must be lowercase alphanumeric with hyphens'),
  quotaRows: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  quotaRows: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  quotaRows: z.number().int().positive().optional(),
  maxTables: z.number().int().positive().optional(),
});
