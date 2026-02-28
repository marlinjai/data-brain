// Re-export shared constants from brain-core
export { API_KEY_PREFIX_LIVE, API_KEY_PREFIX_TEST, RETRY_CONFIG } from '@marlinjai/brain-core';

export const DEFAULT_QUOTA_ROWS = 100_000;
export const DEFAULT_MAX_TABLES = 100;
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 200;

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

export const BATCH_METHODS = [
  'createTable', 'getTable', 'updateTable', 'deleteTable', 'listTables',
  'createColumn', 'getColumns', 'getColumn', 'updateColumn', 'deleteColumn', 'reorderColumns',
  'createRow', 'getRow', 'getRows', 'updateRow', 'deleteRow',
  'archiveRow', 'unarchiveRow', 'bulkCreateRows', 'bulkDeleteRows', 'bulkArchiveRows',
  'createView', 'getViews', 'getView', 'updateView', 'deleteView', 'reorderViews',
  'createSelectOption', 'getSelectOptions', 'updateSelectOption', 'deleteSelectOption', 'reorderSelectOptions',
  'createRelation', 'deleteRelation', 'getRelatedRows', 'getRelationsForRow',
  'addFileReference', 'removeFileReference', 'getFileReferences', 'reorderFileReferences',
] as const;

export type BatchMethod = (typeof BATCH_METHODS)[number];
