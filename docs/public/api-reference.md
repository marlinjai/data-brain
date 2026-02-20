---
title: API Reference
description: REST API endpoint documentation
order: 3
icon: globe
---

# API Reference

Base URL: `https://data-brain-api.marlin-pohl.workers.dev`

All endpoints (except admin and health) require tenant authentication via Bearer token.

## Authentication

Include your API key in the `Authorization` header:

```
Authorization: Bearer dbr_live_your_api_key_here
```

Admin endpoints use a separate admin API key.

## Error Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

Common error codes: `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`, `QUOTA_EXCEEDED`, `CONFLICT`.

---

## Tables

### List Tables

```
GET /api/v1/tables
```

**Auth:** Tenant API key (Bearer token)

**Example Response (200):**

```json
[
  {
    "id": "tbl_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "workspaceId": "ws_tenant-uuid",
    "name": "Contacts",
    "description": null,
    "icon": null,
    "createdAt": "2026-02-20T10:00:00.000Z",
    "updatedAt": "2026-02-20T10:00:00.000Z"
  }
]
```

### Create Table

```
POST /api/v1/tables
```

**Auth:** Tenant API key (Bearer token)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Table name (1--255 chars) |
| `description` | string | No | Table description (max 1000 chars) |
| `icon` | string | No | Icon identifier (max 50 chars) |

**Example Request:**

```json
{
  "name": "Contacts",
  "description": "Customer contact information"
}
```

**Example Response (201):**

```json
{
  "id": "tbl_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "workspaceId": "ws_tenant-uuid",
  "name": "Contacts",
  "description": "Customer contact information",
  "icon": null,
  "createdAt": "2026-02-20T10:00:00.000Z",
  "updatedAt": "2026-02-20T10:00:00.000Z"
}
```

### Get Table

```
GET /api/v1/tables/:tableId
```

**Auth:** Tenant API key (Bearer token)

**Error Responses:**
- `404` -- Table not found or belongs to another tenant

### Update Table

```
PATCH /api/v1/tables/:tableId
```

**Auth:** Tenant API key (Bearer token)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New table name |
| `description` | string | No | New description |
| `icon` | string | No | New icon |

### Delete Table

```
DELETE /api/v1/tables/:tableId
```

**Auth:** Tenant API key (Bearer token)

**Example Response (200):**

```json
{ "success": true }
```

---

## Columns

### List Columns

```
GET /api/v1/tables/:tableId/columns
```

**Auth:** Tenant API key (Bearer token)

**Example Response (200):**

```json
[
  {
    "id": "col_uuid",
    "tableId": "tbl_uuid",
    "name": "Full Name",
    "type": "text",
    "position": 0,
    "width": 200,
    "isPrimary": true,
    "config": {}
  }
]
```

### Create Column

```
POST /api/v1/tables/:tableId/columns
```

**Auth:** Tenant API key (Bearer token)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Column name (1--255 chars) |
| `type` | string | Yes | Column type (see below) |
| `position` | number | No | Display position |
| `width` | number | No | Column width in pixels |
| `isPrimary` | boolean | No | Whether this is the primary column |
| `config` | object | No | Type-specific configuration |

**Column types:** `text`, `number`, `date`, `boolean`, `select`, `multi_select`, `url`, `file`, `formula`, `relation`, `rollup`, `created_time`, `last_edited_time`

### Get Column

```
GET /api/v1/columns/:columnId
```

### Update Column

```
PATCH /api/v1/columns/:columnId
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New column name |
| `width` | number | No | New column width |
| `config` | object | No | New configuration |

### Delete Column

```
DELETE /api/v1/columns/:columnId
```

### Reorder Columns

```
PUT /api/v1/tables/:tableId/columns/reorder
```

**Request Body:** Array of column UUIDs in desired order.

```json
["col_uuid_3", "col_uuid_1", "col_uuid_2"]
```

---

## Rows

### Query Rows

```
GET /api/v1/tables/:tableId/rows
```

**Auth:** Tenant API key (Bearer token)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Results per page (1--200) |
| `offset` | number | 0 | Number of rows to skip |
| `cursor` | string | -- | Pagination cursor |
| `includeArchived` | boolean | false | Include archived rows |
| `filters` | string | -- | JSON-encoded array of filter objects |
| `sorts` | string | -- | JSON-encoded array of sort objects |

**Filter object:** `{ "columnId": "col_1", "operator": "contains", "value": "Alice" }`

**Sort object:** `{ "columnId": "col_1", "direction": "asc" }`

**Example Response (200):**

```json
{
  "rows": [
    {
      "id": "row_uuid",
      "tableId": "tbl_uuid",
      "cells": {
        "col_1": { "value": "Alice" },
        "col_2": { "value": "alice@example.com" }
      },
      "isArchived": false,
      "createdAt": "2026-02-20T10:05:00.000Z",
      "updatedAt": "2026-02-20T10:05:00.000Z"
    }
  ],
  "total": 1
}
```

### Create Row

```
POST /api/v1/tables/:tableId/rows
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cells` | object | No | Column ID to cell value map |
| `parentRowId` | string | No | UUID of parent row (for sub-items) |

**Example Request:**

```json
{
  "cells": {
    "col_1": { "value": "Alice" },
    "col_2": { "value": "alice@example.com" }
  }
}
```

### Get Row

```
GET /api/v1/rows/:rowId
```

### Update Row

```
PATCH /api/v1/rows/:rowId
```

**Request Body:** Object mapping column IDs to cell values.

```json
{
  "col_1": { "value": "Alice Johnson" }
}
```

### Delete Row

```
DELETE /api/v1/rows/:rowId
```

### Archive Row

```
POST /api/v1/rows/:rowId/archive
```

### Unarchive Row

```
POST /api/v1/rows/:rowId/unarchive
```

### Bulk Create Rows

```
POST /api/v1/tables/:tableId/rows/bulk
```

**Request Body:** Array of row objects (1--1,000).

```json
[
  { "cells": { "col_1": { "value": "Alice" } } },
  { "cells": { "col_1": { "value": "Bob" } } }
]
```

**Example Response (201):** Array of created `Row` objects.

### Bulk Delete Rows

```
DELETE /api/v1/rows/bulk
```

**Request Body:** Array of row UUIDs (1--1,000).

```json
["row_uuid_1", "row_uuid_2", "row_uuid_3"]
```

### Bulk Archive Rows

```
POST /api/v1/rows/bulk/archive
```

**Request Body:** Array of row UUIDs (1--1,000).

---

## Views

### List Views

```
GET /api/v1/tables/:tableId/views
```

### Create View

```
POST /api/v1/tables/:tableId/views
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | View name (1--255 chars) |
| `type` | string | Yes | View type: `table`, `board`, `calendar`, `gallery`, `timeline`, `list` |
| `isDefault` | boolean | No | Whether this is the default view |
| `position` | number | No | Display position |
| `config` | object | No | View configuration (filters, sorts, column visibility) |

**Example Request:**

```json
{
  "name": "Active Contacts",
  "type": "table",
  "config": {
    "filters": [{ "columnId": "col_3", "operator": "equals", "value": true }]
  }
}
```

### Get View

```
GET /api/v1/views/:viewId
```

### Update View

```
PATCH /api/v1/views/:viewId
```

### Delete View

```
DELETE /api/v1/views/:viewId
```

### Reorder Views

```
PUT /api/v1/tables/:tableId/views/reorder
```

**Request Body:** Array of view UUIDs in desired order.

---

## Select Options

### List Options

```
GET /api/v1/columns/:columnId/options
```

### Create Option

```
POST /api/v1/columns/:columnId/options
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Option name (1--255 chars) |
| `color` | string | No | Color identifier (max 50 chars) |
| `position` | number | No | Display position |

**Example Request:**

```json
{
  "name": "High Priority",
  "color": "red"
}
```

### Update Option

```
PATCH /api/v1/options/:optionId
```

### Delete Option

```
DELETE /api/v1/options/:optionId
```

### Reorder Options

```
PUT /api/v1/columns/:columnId/options/reorder
```

**Request Body:** Array of option UUIDs in desired order.

---

## Relations

### Create Relation

```
POST /api/v1/relations
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sourceRowId` | string | Yes | UUID of the source row |
| `sourceColumnId` | string | Yes | UUID of the relation column |
| `targetRowId` | string | Yes | UUID of the target row |

**Example Request:**

```json
{
  "sourceRowId": "row_uuid_1",
  "sourceColumnId": "col_relation",
  "targetRowId": "row_uuid_2"
}
```

### Delete Relation

```
DELETE /api/v1/relations
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sourceRowId` | string | Yes | UUID of the source row |
| `columnId` | string | Yes | UUID of the relation column |
| `targetRowId` | string | Yes | UUID of the target row |

### Get Related Rows

```
GET /api/v1/rows/:rowId/relations/:columnId
```

**Example Response (200):** Array of `Row` objects.

### Get All Relations for Row

```
GET /api/v1/rows/:rowId/relations
```

**Example Response (200):**

```json
[
  { "columnId": "col_relation_1", "targetRowId": "row_uuid_2" },
  { "columnId": "col_relation_1", "targetRowId": "row_uuid_3" }
]
```

---

## File References

### Add File Reference

```
POST /api/v1/file-refs
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rowId` | string | Yes | UUID of the row |
| `columnId` | string | Yes | UUID of the file column |
| `fileId` | string | Yes | External file identifier |
| `fileUrl` | string | Yes | URL to the file |
| `originalName` | string | Yes | Original filename (1--255 chars) |
| `mimeType` | string | Yes | MIME type (1--100 chars) |
| `sizeBytes` | number | No | File size in bytes |
| `position` | number | No | Display position |
| `metadata` | object | No | Additional metadata |

**Example Request:**

```json
{
  "rowId": "row_uuid",
  "columnId": "col_file",
  "fileId": "sb_file_id",
  "fileUrl": "https://storage.example.com/files/receipt.pdf",
  "originalName": "receipt.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 245000
}
```

### Remove File Reference

```
DELETE /api/v1/file-refs/:fileRefId
```

### Get File References

```
GET /api/v1/rows/:rowId/files/:columnId
```

**Example Response (200):** Array of `FileReference` objects.

### Reorder File References

```
PUT /api/v1/rows/:rowId/files/:columnId/reorder
```

**Request Body:** Array of file reference UUIDs in desired order.

---

## Tenant

### Get Tenant Info

```
GET /api/v1/tenant/info
```

**Auth:** Tenant API key (Bearer token)

**Example Response (200):**

```json
{
  "id": "tenant-uuid",
  "name": "My App",
  "quotaRows": 100000,
  "usedRows": 1234,
  "maxTables": 100,
  "createdAt": "2026-02-15T08:00:00.000Z"
}
```

---

## Admin

Admin endpoints require the `ADMIN_API_KEY` environment variable to be configured. They use a separate API key from tenant keys.

### Create Tenant

```
POST /api/v1/admin/tenants
```

**Auth:** Admin API key (Bearer token)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Tenant name (1--100 chars) |
| `quotaRows` | number | No | Max rows (default: 100,000) |
| `maxTables` | number | No | Max tables (default: 100) |

**Example Request:**

```json
{
  "name": "My Application",
  "quotaRows": 500000,
  "maxTables": 200
}
```

**Example Response (201):**

```json
{
  "tenant": {
    "id": "new-tenant-uuid",
    "name": "My Application",
    "quotaRows": 500000,
    "usedRows": 0,
    "maxTables": 200,
    "createdAt": "2026-02-20T10:00:00.000Z"
  },
  "apiKey": "dbr_live_abc123def456..."
}
```

> **Important:** The `apiKey` field is only returned once at creation. Store it securely.

---

## Health

### Health Check

```
GET /health
```

**Auth:** None

**Example Response (200):**

```json
{
  "status": "ok",
  "timestamp": "2026-02-20T10:00:00.000Z",
  "environment": "production"
}
```
