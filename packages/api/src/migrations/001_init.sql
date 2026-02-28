-- Data Brain — PostgreSQL Schema (combined from D1 migrations)
-- This file is auto-run by the Node.js entry point on startup.

-- ============================================================================
-- Tenants
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  api_key_hash  TEXT NOT NULL,
  quota_rows    INTEGER NOT NULL DEFAULT 100000,
  used_rows     INTEGER NOT NULL DEFAULT 0,
  max_tables    INTEGER NOT NULL DEFAULT 100,
  created_at    BIGINT NOT NULL,
  updated_at    BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_api_key_hash ON tenants(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);

-- ============================================================================
-- Workspaces
-- ============================================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  quota_rows    INTEGER,
  used_rows     INTEGER NOT NULL DEFAULT 0,
  metadata      TEXT,
  created_at    TEXT NOT NULL DEFAULT NOW()::TEXT,
  updated_at    TEXT NOT NULL DEFAULT NOW()::TEXT,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_tenant ON workspaces(tenant_id);

-- ============================================================================
-- Data Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS dt_tables (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  created_at    TEXT NOT NULL DEFAULT NOW()::TEXT,
  updated_at    TEXT NOT NULL DEFAULT NOW()::TEXT
);

CREATE INDEX IF NOT EXISTS idx_dt_tables_workspace ON dt_tables(workspace_id);

-- ============================================================================
-- Columns
-- ============================================================================

CREATE TABLE IF NOT EXISTS dt_columns (
  id            TEXT PRIMARY KEY,
  table_id      TEXT NOT NULL REFERENCES dt_tables(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  width         INTEGER NOT NULL DEFAULT 200,
  is_primary    INTEGER NOT NULL DEFAULT 0,
  config        TEXT,
  created_at    TEXT NOT NULL DEFAULT NOW()::TEXT
);

CREATE INDEX IF NOT EXISTS idx_dt_columns_table ON dt_columns(table_id);

-- ============================================================================
-- Select Options
-- ============================================================================

CREATE TABLE IF NOT EXISTS dt_select_options (
  id            TEXT PRIMARY KEY,
  column_id     TEXT NOT NULL REFERENCES dt_columns(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  position      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dt_select_options_column ON dt_select_options(column_id);

-- ============================================================================
-- Rows
-- ============================================================================

CREATE TABLE IF NOT EXISTS dt_rows (
  id            TEXT PRIMARY KEY,
  table_id      TEXT NOT NULL REFERENCES dt_tables(id) ON DELETE CASCADE,
  cells         TEXT NOT NULL DEFAULT '{}',
  computed      TEXT,
  _title        TEXT,
  _archived     INTEGER NOT NULL DEFAULT 0,
  _created_at   TEXT NOT NULL DEFAULT NOW()::TEXT,
  _updated_at   TEXT NOT NULL DEFAULT NOW()::TEXT
);

CREATE INDEX IF NOT EXISTS idx_dt_rows_table ON dt_rows(table_id);
CREATE INDEX IF NOT EXISTS idx_dt_rows_archived ON dt_rows(table_id, _archived);

-- ============================================================================
-- Relations
-- ============================================================================

CREATE TABLE IF NOT EXISTS dt_relations (
  id               TEXT PRIMARY KEY,
  source_row_id    TEXT NOT NULL,
  source_column_id TEXT NOT NULL,
  target_row_id    TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT NOW()::TEXT,
  UNIQUE(source_row_id, source_column_id, target_row_id)
);

CREATE INDEX IF NOT EXISTS idx_dt_relations_source ON dt_relations(source_row_id, source_column_id);
CREATE INDEX IF NOT EXISTS idx_dt_relations_target ON dt_relations(target_row_id);

-- ============================================================================
-- File References
-- ============================================================================

CREATE TABLE IF NOT EXISTS dt_files (
  id            TEXT PRIMARY KEY,
  row_id        TEXT NOT NULL REFERENCES dt_rows(id) ON DELETE CASCADE,
  column_id     TEXT NOT NULL,
  file_id       TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type     TEXT NOT NULL,
  size_bytes    INTEGER,
  position      INTEGER NOT NULL DEFAULT 0,
  metadata      TEXT
);

CREATE INDEX IF NOT EXISTS idx_dt_files_row_column ON dt_files(row_id, column_id);

-- ============================================================================
-- Views
-- ============================================================================

CREATE TABLE IF NOT EXISTS dt_views (
  id            TEXT PRIMARY KEY,
  table_id      TEXT NOT NULL REFERENCES dt_tables(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'table',
  is_default    INTEGER NOT NULL DEFAULT 0,
  position      INTEGER NOT NULL DEFAULT 0,
  config        TEXT,
  created_at    TEXT NOT NULL DEFAULT NOW()::TEXT,
  updated_at    TEXT NOT NULL DEFAULT NOW()::TEXT
);

CREATE INDEX IF NOT EXISTS idx_dt_views_table ON dt_views(table_id);
