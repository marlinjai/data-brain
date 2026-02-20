// Main client
export { DataBrain, DataBrain as default } from './client';

// Types
export type {
  DataBrainConfig, TenantInfo, BatchOperation, BatchResult,
  Workspace, CreateWorkspaceInput, UpdateWorkspaceInput,
} from './types';

// Errors
export {
  DataBrainError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  QuotaExceededError,
  ConflictError,
  NetworkError,
  BatchError,
} from './errors';

// Re-export all data-table-core types for convenience
export type {
  Table, Column, Row, View, SelectOption, FileReference,
  CreateTableInput, UpdateTableInput,
  CreateColumnInput, UpdateColumnInput,
  CreateRowInput, QueryOptions, QueryResult,
  CreateViewInput, UpdateViewInput,
  CreateSelectOptionInput, UpdateSelectOptionInput,
  CreateRelationInput, CreateFileRefInput,
  CellValue, ColumnType, ViewType, FilterOperator, QueryFilter, QuerySort,
} from '@marlinjai/data-table-core';
