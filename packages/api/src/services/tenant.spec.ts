import { describe, it, expect } from 'vitest';
import { toTenantInfo } from './tenant';
import type { Tenant } from '@data-brain/shared';

describe('toTenantInfo', () => {
  it('maps Tenant to TenantInfo', () => {
    const tenant: Tenant = {
      id: 't-1',
      name: 'Acme Corp',
      apiKeyHash: 'hash123',
      quotaRows: 100_000,
      usedRows: 500,
      maxTables: 100,
      createdAt: 1704067200000, // 2024-01-01T00:00:00Z
      updatedAt: 1704067200000,
    };

    const info = toTenantInfo(tenant);
    expect(info).toEqual({
      id: 't-1',
      name: 'Acme Corp',
      quotaRows: 100_000,
      usedRows: 500,
      maxTables: 100,
      createdAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('does not include apiKeyHash in output', () => {
    const tenant: Tenant = {
      id: 't-1',
      name: 'Test',
      apiKeyHash: 'secret',
      quotaRows: 50_000,
      usedRows: 0,
      maxTables: 50,
      createdAt: 0,
      updatedAt: 0,
    };

    const info = toTenantInfo(tenant);
    expect(info).not.toHaveProperty('apiKeyHash');
    expect(info).not.toHaveProperty('updatedAt');
  });
});
