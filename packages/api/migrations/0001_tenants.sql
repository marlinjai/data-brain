-- Data Brain tenant management
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  quota_rows INTEGER NOT NULL DEFAULT 100000,
  used_rows INTEGER NOT NULL DEFAULT 0,
  max_tables INTEGER NOT NULL DEFAULT 100,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_api_key_hash ON tenants(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);
