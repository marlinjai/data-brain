---
title: SDK Guide
description: TypeScript SDK usage and reference
order: 2
icon: package
---

# SDK Guide

The Data Brain TypeScript SDK provides a type-safe client for managing tables, columns, rows, views, relations, select options, and file references over HTTP.

## Installation

```bash
npm install @marlinjai/data-brain-sdk
```

The SDK ships ESM and CommonJS builds with full TypeScript type definitions.

## Creating a Client

```typescript
import { DataBrain } from '@marlinjai/data-brain-sdk';

const db = new DataBrain({
  apiKey: 'dbr_live_your_api_key_here',
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | (required) | Tenant API key (`dbr_live_...` or `dbr_test_...`) |
| `baseUrl` | string | `https://data-brain-api.marlin-pohl.workers.dev` | API base URL |
| `timeout` | number | `30000` | Request timeout in milliseconds |
| `maxRetries` | number | `3` | Number of retry attempts for failed requests |

## Tables

```typescript
// Create a table
const table = await db.createTable({ name: 'Contacts' });

// Get a table (returns null if not found)
const found = await db.getTable(table.id);

// Update a table
const updated = await db.updateTable(table.id, { name: 'People' });

// Delete a table
await db.deleteTable(table.id);

// List all tables for your tenant
const tables = await db.listTables(workspaceId);
```

## Columns

```typescript
// Create a column
const column = await db.createColumn({
  tableId: table.id,
  name: 'Full Name',
  type: 'text',
  isPrimary: true,
});

// List columns for a table
const columns = await db.getColumns(table.id);

// Get a single column (returns null if not found)
const col = await db.getColumn(column.id);

// Update a column
await db.updateColumn(column.id, { name: 'Name', width: 200 });

// Delete a column
await db.deleteColumn(column.id);

// Reorder columns
await db.reorderColumns(table.id, ['col_3', 'col_1', 'col_2']);
```

### Column Types

Data Brain supports all `@marlinjai/data-table-core` column types:

`text`, `number`, `date`, `boolean`, `select`, `multi_select`, `url`, `file`, `formula`, `relation`, `rollup`, `created_time`, `last_edited_time`

## Rows

```typescript
// Create a row
const row = await db.createRow({
  tableId: table.id,
  cells: {
    col_1: { value: 'Alice' },
    col_2: { value: 'alice@example.com' },
  },
});

// Get a row (returns null if not found)
const found = await db.getRow(row.id);

// Update row cells
const updated = await db.updateRow(row.id, {
  col_1: { value: 'Alice Johnson' },
});

// Delete a row
await db.deleteRow(row.id);

// Archive / unarchive
await db.archiveRow(row.id);
await db.unarchiveRow(row.id);
```

### Querying Rows

```typescript
const result = await db.getRows(table.id, {
  limit: 50,
  offset: 0,
  includeArchived: false,
  filters: [
    { columnId: 'col_1', operator: 'contains', value: 'Alice' },
  ],
  sorts: [
    { columnId: 'col_2', direction: 'asc' },
  ],
});

console.log(result.rows);  // Row[]
console.log(result.total); // number
```

#### Query Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limit` | number | 50 | Results per page (1--200) |
| `offset` | number | 0 | Number of rows to skip |
| `cursor` | string | -- | Pagination cursor from previous response |
| `includeArchived` | boolean | false | Include archived rows |
| `filters` | `QueryFilter[]` | -- | Array of filter conditions |
| `sorts` | `QuerySort[]` | -- | Array of sort directives |

#### Filter Operators

`equals`, `notEquals`, `contains`, `notContains`, `startsWith`, `endsWith`, `greaterThan`, `greaterThanOrEquals`, `lessThan`, `lessThanOrEquals`, `isEmpty`, `isNotEmpty`, `isIn`, `isNotIn`

### Bulk Operations

```typescript
// Bulk create rows (up to 1,000)
const rows = await db.bulkCreateRows([
  { tableId: table.id, cells: { col_1: { value: 'Alice' } } },
  { tableId: table.id, cells: { col_1: { value: 'Bob' } } },
]);

// Bulk delete rows (up to 1,000)
await db.bulkDeleteRows(['row_1', 'row_2', 'row_3']);

// Bulk archive rows (up to 1,000)
await db.bulkArchiveRows(['row_1', 'row_2']);
```

## Views

```typescript
// Create a view
const view = await db.createView({
  tableId: table.id,
  name: 'Active Contacts',
  type: 'table',
  config: {
    filters: [{ columnId: 'col_3', operator: 'equals', value: true }],
  },
});

// List views for a table
const views = await db.getViews(table.id);

// Get a single view (returns null if not found)
const found = await db.getView(view.id);

// Update a view
await db.updateView(view.id, { name: 'All Contacts' });

// Delete a view
await db.deleteView(view.id);

// Reorder views
await db.reorderViews(table.id, ['view_2', 'view_1']);
```

### View Types

`table`, `board`, `calendar`, `gallery`, `timeline`, `list`

## Select Options

```typescript
// Create an option for a select/multi_select column
const option = await db.createSelectOption({
  columnId: column.id,
  name: 'High Priority',
  color: 'red',
});

// List options for a column
const options = await db.getSelectOptions(column.id);

// Update an option
await db.updateSelectOption(option.id, { name: 'Critical', color: 'orange' });

// Delete an option
await db.deleteSelectOption(option.id);

// Reorder options
await db.reorderSelectOptions(column.id, ['opt_2', 'opt_1', 'opt_3']);
```

## Relations

```typescript
// Create a relation between two rows
await db.createRelation({
  sourceRowId: 'row_1',
  sourceColumnId: 'col_relation',
  targetRowId: 'row_2',
});

// Get related rows for a specific column
const related = await db.getRelatedRows('row_1', 'col_relation');

// Get all relations for a row
const allRelations = await db.getRelationsForRow('row_1');
// [{ columnId: "col_relation", targetRowId: "row_2" }, ...]

// Delete a relation
await db.deleteRelation('row_1', 'col_relation', 'row_2');
```

## File References

Link external files (e.g. from Storage Brain) to rows:

```typescript
// Add a file reference
const ref = await db.addFileReference({
  rowId: 'row_1',
  columnId: 'col_file',
  fileId: 'sb_file_id',
  fileUrl: 'https://storage.example.com/files/receipt.pdf',
  originalName: 'receipt.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 245000,
});

// Get file references for a row + column
const refs = await db.getFileReferences('row_1', 'col_file');

// Reorder file references
await db.reorderFileReferences('row_1', 'col_file', ['ref_2', 'ref_1']);

// Remove a file reference
await db.removeFileReference(ref.id);
```

## Batch Operations

> **Note:** The batch endpoint is currently disabled pending per-operation tenant isolation. The SDK method exists but will return an error if called.

```typescript
const results = await db.batch([
  { method: 'createRow', params: { tableId: 'tbl_1', cells: { col_1: { value: 'Test' } } } },
  { method: 'getRows', params: { tableId: 'tbl_1', limit: 10 } },
]);
```

## Tenant Info

```typescript
const info = await db.getTenantInfo();

console.log(info.id);        // "tenant-uuid"
console.log(info.name);      // "My App"
console.log(info.quotaRows); // 100000
console.log(info.usedRows);  // 1234
console.log(info.maxTables); // 100
```

## Error Handling

The SDK provides specific error classes for different failure scenarios:

```typescript
import {
  DataBrain,
  DataBrainError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  QuotaExceededError,
  ConflictError,
  NetworkError,
  BatchError,
} from '@marlinjai/data-brain-sdk';

try {
  await db.createTable({ name: 'My Table' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Invalid or expired API key (HTTP 401)
  } else if (error instanceof NotFoundError) {
    // Resource not found (HTTP 404)
  } else if (error instanceof ValidationError) {
    // Request validation failed (HTTP 400)
    console.log(error.errors); // [{ path: "name", message: "..." }]
  } else if (error instanceof QuotaExceededError) {
    // Quota exceeded (HTTP 403)
  } else if (error instanceof ConflictError) {
    // Conflict (HTTP 409)
  } else if (error instanceof NetworkError) {
    // Connection failure or timeout
    console.log(error.originalError);
  }
}
```

All error classes extend `DataBrainError`, which has the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `message` | string | Human-readable error message |
| `code` | string | Machine-readable error code |
| `statusCode` | number or undefined | HTTP status code (if from API) |
| `details` | object or undefined | Additional error context |

### Retry Behavior

The SDK automatically retries requests that fail with server errors (5xx) or network issues. Client errors (4xx) are not retried.

Retry configuration:
- **Max attempts:** 3 (configurable via `maxRetries`)
- **Backoff:** Exponential (1s, 2s, 4s, capped at 10s)

## TypeScript Types

The SDK re-exports all `@marlinjai/data-table-core` types for convenience:

```typescript
import type {
  Table, Column, Row, View, SelectOption, FileReference,
  CreateTableInput, UpdateTableInput,
  CreateColumnInput, UpdateColumnInput,
  CreateRowInput, QueryOptions, QueryResult,
  CreateViewInput, UpdateViewInput,
  CreateSelectOptionInput, UpdateSelectOptionInput,
  CreateRelationInput, CreateFileRefInput,
  CellValue, ColumnType, ViewType, FilterOperator, QueryFilter, QuerySort,
} from '@marlinjai/data-brain-sdk';
```

SDK-specific types:

```typescript
import type {
  DataBrainConfig,
  TenantInfo,
  BatchOperation,
  BatchResult,
} from '@marlinjai/data-brain-sdk';
```
