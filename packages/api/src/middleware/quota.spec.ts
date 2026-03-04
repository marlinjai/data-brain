import { describe, it, expect, vi } from 'vitest';
import { checkRowQuota, checkTableQuota, trackRowsCreated, trackRowsDeleted } from './quota';

function mockTenantDb(overrides: Record<string, unknown> = {}) {
  return {
    getWorkspace: vi.fn().mockResolvedValue(null),
    countTenantTables: vi.fn().mockResolvedValue(0),
    incrementUsedRows: vi.fn().mockResolvedValue(undefined),
    decrementUsedRows: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockContext(options: {
  tenant: { id: string; usedRows: number; quotaRows: number; maxTables: number };
  tenantDb?: ReturnType<typeof mockTenantDb>;
  workspaceId?: string;
}) {
  const tenantDb = options.tenantDb ?? mockTenantDb();
  return {
    get: vi.fn((key: string) => {
      if (key === 'tenant') return options.tenant;
      if (key === 'tenantDb') return tenantDb;
      return undefined;
    }),
    req: {
      header: vi.fn((name: string) => {
        if (name === 'X-Workspace-Id') return options.workspaceId;
        return undefined;
      }),
    },
  } as any;
}

// ── checkRowQuota ───────────────────────────────────────────────────────

describe('checkRowQuota', () => {
  it('passes when under tenant quota', async () => {
    const c = mockContext({
      tenant: { id: 't1', usedRows: 50, quotaRows: 100, maxTables: 10 },
    });
    await expect(checkRowQuota(c)).resolves.toBeUndefined();
  });

  it('throws when tenant quota is reached', async () => {
    const c = mockContext({
      tenant: { id: 't1', usedRows: 100, quotaRows: 100, maxTables: 10 },
    });
    await expect(checkRowQuota(c)).rejects.toThrow('Row quota exceeded');
  });

  it('throws when bulk create would exceed tenant quota', async () => {
    const c = mockContext({
      tenant: { id: 't1', usedRows: 95, quotaRows: 100, maxTables: 10 },
    });
    await expect(checkRowQuota(c, 10)).rejects.toThrow('Row quota exceeded');
  });

  it('allows bulk create that exactly fills tenant quota', async () => {
    const c = mockContext({
      tenant: { id: 't1', usedRows: 95, quotaRows: 100, maxTables: 10 },
    });
    await expect(checkRowQuota(c, 5)).resolves.toBeUndefined();
  });

  it('skips workspace check when workspace has no quota', async () => {
    const tenantDb = mockTenantDb({
      getWorkspace: vi.fn().mockResolvedValue({ quotaRows: null, usedRows: 999 }),
    });
    const c = mockContext({
      tenant: { id: 't1', usedRows: 50, quotaRows: 100, maxTables: 10 },
      tenantDb,
    });
    await expect(checkRowQuota(c)).resolves.toBeUndefined();
  });

  it('throws when workspace quota is reached', async () => {
    const tenantDb = mockTenantDb({
      getWorkspace: vi.fn().mockResolvedValue({ quotaRows: 10, usedRows: 10 }),
    });
    const c = mockContext({
      tenant: { id: 't1', usedRows: 50, quotaRows: 100, maxTables: 10 },
      tenantDb,
      workspaceId: 'ws-1',
    });
    await expect(checkRowQuota(c)).rejects.toThrow('Workspace row quota exceeded');
  });

  it('passes when workspace is under quota', async () => {
    const tenantDb = mockTenantDb({
      getWorkspace: vi.fn().mockResolvedValue({ quotaRows: 20, usedRows: 10 }),
    });
    const c = mockContext({
      tenant: { id: 't1', usedRows: 50, quotaRows: 100, maxTables: 10 },
      tenantDb,
      workspaceId: 'ws-1',
    });
    await expect(checkRowQuota(c)).resolves.toBeUndefined();
  });

  it('skips workspace check when no workspace row exists', async () => {
    const c = mockContext({
      tenant: { id: 't1', usedRows: 50, quotaRows: 100, maxTables: 10 },
    });
    await expect(checkRowQuota(c)).resolves.toBeUndefined();
  });
});

// ── checkTableQuota ─────────────────────────────────────────────────────

describe('checkTableQuota', () => {
  it('passes when under table quota', async () => {
    const tenantDb = mockTenantDb({
      countTenantTables: vi.fn().mockResolvedValue(5),
    });
    const c = mockContext({
      tenant: { id: 't1', usedRows: 0, quotaRows: 100, maxTables: 10 },
      tenantDb,
    });
    await expect(checkTableQuota(c)).resolves.toBeUndefined();
  });

  it('throws when table quota is reached', async () => {
    const tenantDb = mockTenantDb({
      countTenantTables: vi.fn().mockResolvedValue(10),
    });
    const c = mockContext({
      tenant: { id: 't1', usedRows: 0, quotaRows: 100, maxTables: 10 },
      tenantDb,
    });
    await expect(checkTableQuota(c)).rejects.toThrow('Table quota exceeded');
  });

  it('throws when table quota is exceeded', async () => {
    const tenantDb = mockTenantDb({
      countTenantTables: vi.fn().mockResolvedValue(15),
    });
    const c = mockContext({
      tenant: { id: 't1', usedRows: 0, quotaRows: 100, maxTables: 10 },
      tenantDb,
    });
    await expect(checkTableQuota(c)).rejects.toThrow('Table quota exceeded');
  });
});

// ── trackRowsCreated ────────────────────────────────────────────────────

describe('trackRowsCreated', () => {
  it('calls incrementUsedRows with correct args', async () => {
    const tenantDb = mockTenantDb();
    const c = mockContext({
      tenant: { id: 't1', usedRows: 50, quotaRows: 100, maxTables: 10 },
      tenantDb,
    });
    await trackRowsCreated(c, 5);
    expect(tenantDb.incrementUsedRows).toHaveBeenCalledWith('t1', 't1', 5);
  });

  it('uses workspace header when provided', async () => {
    const tenantDb = mockTenantDb();
    const c = mockContext({
      tenant: { id: 't1', usedRows: 50, quotaRows: 100, maxTables: 10 },
      tenantDb,
      workspaceId: 'ws-1',
    });
    await trackRowsCreated(c, 1);
    expect(tenantDb.incrementUsedRows).toHaveBeenCalledWith('t1', 'ws-1', 1);
  });

  it('defaults count to 1', async () => {
    const tenantDb = mockTenantDb();
    const c = mockContext({
      tenant: { id: 't1', usedRows: 50, quotaRows: 100, maxTables: 10 },
      tenantDb,
    });
    await trackRowsCreated(c);
    expect(tenantDb.incrementUsedRows).toHaveBeenCalledWith('t1', 't1', 1);
  });
});

// ── trackRowsDeleted ────────────────────────────────────────────────────

describe('trackRowsDeleted', () => {
  it('calls decrementUsedRows with correct args', async () => {
    const tenantDb = mockTenantDb();
    const c = mockContext({
      tenant: { id: 't1', usedRows: 50, quotaRows: 100, maxTables: 10 },
      tenantDb,
    });
    await trackRowsDeleted(c, 3);
    expect(tenantDb.decrementUsedRows).toHaveBeenCalledWith('t1', 't1', 3);
  });

  it('uses workspace header when provided', async () => {
    const tenantDb = mockTenantDb();
    const c = mockContext({
      tenant: { id: 't1', usedRows: 50, quotaRows: 100, maxTables: 10 },
      tenantDb,
      workspaceId: 'ws-1',
    });
    await trackRowsDeleted(c, 10);
    expect(tenantDb.decrementUsedRows).toHaveBeenCalledWith('t1', 'ws-1', 10);
  });

  it('defaults count to 1', async () => {
    const tenantDb = mockTenantDb();
    const c = mockContext({
      tenant: { id: 't1', usedRows: 50, quotaRows: 100, maxTables: 10 },
      tenantDb,
    });
    await trackRowsDeleted(c);
    expect(tenantDb.decrementUsedRows).toHaveBeenCalledWith('t1', 't1', 1);
  });
});
