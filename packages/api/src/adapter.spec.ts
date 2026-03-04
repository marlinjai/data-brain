import { describe, it, expect, vi } from 'vitest';
import { getAdapter, getTenantDb, getWorkspaceId } from './adapter';

function mockContext(variables: Record<string, any>, headerWorkspaceId?: string) {
  return {
    get: vi.fn((key: string) => variables[key]),
    req: {
      header: vi.fn((name: string) => {
        if (name === 'X-Workspace-Id') return headerWorkspaceId;
        return undefined;
      }),
    },
  } as any;
}

describe('getAdapter', () => {
  it('returns the adapter from context', () => {
    const adapter = { fake: true };
    const c = mockContext({ adapter });
    expect(getAdapter(c)).toBe(adapter);
  });
});

describe('getTenantDb', () => {
  it('returns the tenantDb from context', () => {
    const tenantDb = { fake: true };
    const c = mockContext({ tenantDb });
    expect(getTenantDb(c)).toBe(tenantDb);
  });
});

describe('getWorkspaceId', () => {
  it('returns X-Workspace-Id header if present', () => {
    const c = mockContext({ tenant: { id: 'tenant-fallback' } }, 'ws-from-header');
    expect(getWorkspaceId(c)).toBe('ws-from-header');
  });

  it('falls back to tenant.id if no header', () => {
    const c = mockContext({ tenant: { id: 'tenant-fallback' } });
    expect(getWorkspaceId(c)).toBe('tenant-fallback');
  });
});
