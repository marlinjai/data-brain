import { describe, it, expect, vi } from 'vitest';
import { verifyTableOwnership, verifyRowOwnership, verifyColumnOwnership } from './ownership';

// Minimal mock for Hono Context
function mockContext(workspaceId: string, headerWorkspaceId?: string) {
  return {
    get: vi.fn((key: string) => {
      if (key === 'tenant') return { id: 'tenant-1' };
      return undefined;
    }),
    req: {
      header: vi.fn((name: string) => {
        if (name === 'X-Workspace-Id') return headerWorkspaceId;
        return undefined;
      }),
    },
  } as any;
}

function mockAdapter(overrides: Record<string, any> = {}) {
  return {
    getTable: vi.fn().mockResolvedValue(null),
    getRow: vi.fn().mockResolvedValue(null),
    getColumn: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as any;
}

describe('verifyTableOwnership', () => {
  it('returns table when owned by workspace', async () => {
    const table = { id: 't1', workspaceId: 'tenant-1' };
    const adapter = mockAdapter({ getTable: vi.fn().mockResolvedValue(table) });
    const c = mockContext('tenant-1');
    const result = await verifyTableOwnership(c, adapter, 't1');
    expect(result).toBe(table);
  });

  it('throws when table not found', async () => {
    const adapter = mockAdapter();
    const c = mockContext('tenant-1');
    await expect(verifyTableOwnership(c, adapter, 't1')).rejects.toThrow('Table not found');
  });

  it('throws when table belongs to different workspace', async () => {
    const table = { id: 't1', workspaceId: 'other-workspace' };
    const adapter = mockAdapter({ getTable: vi.fn().mockResolvedValue(table) });
    const c = mockContext('tenant-1');
    await expect(verifyTableOwnership(c, adapter, 't1')).rejects.toThrow('Table not found');
  });
});

describe('verifyRowOwnership', () => {
  it('returns row when owned', async () => {
    const row = { id: 'r1', tableId: 't1' };
    const table = { id: 't1', workspaceId: 'tenant-1' };
    const adapter = mockAdapter({
      getRow: vi.fn().mockResolvedValue(row),
      getTable: vi.fn().mockResolvedValue(table),
    });
    const c = mockContext('tenant-1');
    const result = await verifyRowOwnership(c, adapter, 'r1');
    expect(result).toBe(row);
  });

  it('throws when row not found', async () => {
    const adapter = mockAdapter();
    const c = mockContext('tenant-1');
    await expect(verifyRowOwnership(c, adapter, 'r1')).rejects.toThrow('Row not found');
  });

  it('throws when row belongs to table in different workspace', async () => {
    const row = { id: 'r1', tableId: 't1' };
    const table = { id: 't1', workspaceId: 'other' };
    const adapter = mockAdapter({
      getRow: vi.fn().mockResolvedValue(row),
      getTable: vi.fn().mockResolvedValue(table),
    });
    const c = mockContext('tenant-1');
    await expect(verifyRowOwnership(c, adapter, 'r1')).rejects.toThrow('Table not found');
  });
});

describe('verifyColumnOwnership', () => {
  it('returns column when owned', async () => {
    const column = { id: 'c1', tableId: 't1' };
    const table = { id: 't1', workspaceId: 'tenant-1' };
    const adapter = mockAdapter({
      getColumn: vi.fn().mockResolvedValue(column),
      getTable: vi.fn().mockResolvedValue(table),
    });
    const c = mockContext('tenant-1');
    const result = await verifyColumnOwnership(c, adapter, 'c1');
    expect(result).toBe(column);
  });

  it('throws when column not found', async () => {
    const adapter = mockAdapter();
    const c = mockContext('tenant-1');
    await expect(verifyColumnOwnership(c, adapter, 'c1')).rejects.toThrow('Column not found');
  });
});
