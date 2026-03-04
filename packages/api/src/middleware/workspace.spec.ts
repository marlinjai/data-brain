import { describe, it, expect, vi } from 'vitest';
import { verifyWorkspaceAccess } from './workspace';

function mockContext(tenantId: string, verifyResult: boolean) {
  return {
    get: vi.fn((key: string) => {
      if (key === 'tenant') return { id: tenantId };
      if (key === 'tenantDb') return {
        verifyWorkspaceAccess: vi.fn().mockResolvedValue(verifyResult),
      };
      return undefined;
    }),
  } as any;
}

describe('verifyWorkspaceAccess', () => {
  it('passes when workspace belongs to tenant', async () => {
    const c = mockContext('tenant-1', true);
    await expect(verifyWorkspaceAccess(c, 'ws-1')).resolves.toBeUndefined();
  });

  it('throws ApiError.notFound when workspace does not belong to tenant', async () => {
    const c = mockContext('tenant-1', false);
    await expect(verifyWorkspaceAccess(c, 'ws-bad')).rejects.toThrow('Workspace not found');
  });
});
