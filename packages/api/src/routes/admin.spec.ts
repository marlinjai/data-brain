import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { toTenantInfo } from '../services/tenant';
import { createTenantSchema, updateTenantSchema, listTenantsQuerySchema } from '@data-brain/shared';
import { ApiError } from '../middleware/error-handler';

/**
 * Integration-style tests for admin routes.
 * Uses a minimal Hono app with mocked adapters and inlined route logic.
 */

function mockTenantDb(overrides: Record<string, unknown> = {}) {
  return {
    createTenant: vi.fn().mockResolvedValue({
      tenant: { id: 't1', name: 'Test', quotaRows: 100000, usedRows: 0, maxTables: 100, createdAt: '2024-01-01T00:00:00.000Z' },
      apiKey: 'sk_live_abc123',
    }),
    listTenants: vi.fn().mockResolvedValue({
      tenants: [{
        id: 't1', name: 'Test', apiKeyHash: 'hash', quotaRows: 100000, usedRows: 500,
        maxTables: 100, createdAt: 1704067200000, updatedAt: 1704067200000,
      }],
      nextCursor: null,
      total: 1,
    }),
    getTenantById: vi.fn().mockResolvedValue({
      id: 't1', name: 'Test', apiKeyHash: 'hash', quotaRows: 100000, usedRows: 500,
      maxTables: 100, createdAt: 1704067200000, updatedAt: 1704067200000,
    }),
    updateTenant: vi.fn().mockResolvedValue({
      id: 't1', name: 'Updated', apiKeyHash: 'hash', quotaRows: 200000, usedRows: 500,
      maxTables: 100, createdAt: 1704067200000, updatedAt: 1704067200000,
    }),
    deleteTenant: vi.fn().mockResolvedValue(true),
    regenerateApiKey: vi.fn().mockResolvedValue('sk_live_newkey'),
    ...overrides,
  };
}

function createTestApp(tenantDb = mockTenantDb()) {
  const app = new Hono();

  // Inject tenantDb (skip real admin auth for tests)
  app.use('*', async (c, next) => {
    (c as any).set('tenantDb', tenantDb);
    await next();
  });

  // Error handler for ApiError
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ error: { code: err.code, message: err.message } }, err.statusCode as any);
    }
    return c.json({ error: { code: 'INTERNAL', message: err.message } }, 500);
  });

  // Inline route handlers (mirrors routes/admin.ts logic)
  app.post('/api/v1/admin/tenants', async (c) => {
    const body = createTenantSchema.parse(await c.req.json());
    const db = (c as any).get('tenantDb');
    const result = await db.createTenant(body);
    return c.json(result, 201);
  });

  app.get('/api/v1/admin/tenants', async (c) => {
    const db = (c as any).get('tenantDb');
    const query = listTenantsQuerySchema.parse({
      limit: c.req.query('limit'),
      cursor: c.req.query('cursor'),
    });
    const result = await db.listTenants(query);
    return c.json({
      tenants: result.tenants.map(toTenantInfo),
      nextCursor: result.nextCursor,
      total: result.total,
    });
  });

  app.get('/api/v1/admin/tenants/:tenantId', async (c) => {
    const db = (c as any).get('tenantDb');
    const tenant = await db.getTenantById(c.req.param('tenantId'));
    if (!tenant) throw ApiError.notFound('Tenant not found');
    return c.json({
      ...toTenantInfo(tenant),
      quota: {
        quotaRows: tenant.quotaRows,
        usedRows: tenant.usedRows,
        availableRows: Math.max(0, tenant.quotaRows - tenant.usedRows),
        usagePercent: tenant.quotaRows > 0
          ? Math.round((tenant.usedRows / tenant.quotaRows) * 10000) / 100
          : 0,
      },
    });
  });

  app.patch('/api/v1/admin/tenants/:tenantId', async (c) => {
    const updates = updateTenantSchema.parse(await c.req.json());
    const db = (c as any).get('tenantDb');
    const tenant = await db.updateTenant(c.req.param('tenantId'), updates);
    if (!tenant) throw ApiError.notFound('Tenant not found');
    return c.json(toTenantInfo(tenant));
  });

  app.delete('/api/v1/admin/tenants/:tenantId', async (c) => {
    const db = (c as any).get('tenantDb');
    const deleted = await db.deleteTenant(c.req.param('tenantId'));
    if (!deleted) throw ApiError.notFound('Tenant not found');
    return c.json({ success: true });
  });

  app.post('/api/v1/admin/tenants/:tenantId/regenerate-key', async (c) => {
    const db = (c as any).get('tenantDb');
    const apiKey = await db.regenerateApiKey(c.req.param('tenantId'));
    if (!apiKey) throw ApiError.notFound('Tenant not found');
    return c.json({
      tenantId: c.req.param('tenantId'),
      apiKey,
      message: 'API key regenerated successfully. Store this key securely.',
    });
  });

  return { app, tenantDb };
}

// ─── POST /admin/tenants ────────────────────────────────────────────────

describe('POST /admin/tenants', () => {
  it('creates a tenant and returns 201', async () => {
    const { app, tenantDb } = createTestApp();
    const res = await app.request('/api/v1/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.tenant.name).toBe('Test');
    expect(json.apiKey).toBeDefined();
    expect(tenantDb.createTenant).toHaveBeenCalledWith({ name: 'Test' });
  });
});

// ─── GET /admin/tenants ─────────────────────────────────────────────────

describe('GET /admin/tenants', () => {
  it('lists tenants', async () => {
    const { app } = createTestApp();
    const res = await app.request('/api/v1/admin/tenants');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tenants).toHaveLength(1);
    expect(json.total).toBe(1);
    expect(json.nextCursor).toBeNull();
    // Verify toTenantInfo strips sensitive fields
    expect(json.tenants[0]).not.toHaveProperty('apiKeyHash');
  });

  it('passes pagination params', async () => {
    const { app, tenantDb } = createTestApp();
    await app.request('/api/v1/admin/tenants?limit=10&cursor=abc');
    expect(tenantDb.listTenants).toHaveBeenCalledWith({ limit: 10, cursor: 'abc' });
  });
});

// ─── GET /admin/tenants/:id ─────────────────────────────────────────────

describe('GET /admin/tenants/:id', () => {
  it('returns tenant with quota details', async () => {
    const { app } = createTestApp();
    const res = await app.request('/api/v1/admin/tenants/t1');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('t1');
    expect(json.quota.quotaRows).toBe(100000);
    expect(json.quota.usedRows).toBe(500);
    expect(json.quota.availableRows).toBe(99500);
    expect(json.quota.usagePercent).toBe(0.5);
  });

  it('returns 404 for nonexistent tenant', async () => {
    const tenantDb = mockTenantDb({ getTenantById: vi.fn().mockResolvedValue(null) });
    const { app } = createTestApp(tenantDb);
    const res = await app.request('/api/v1/admin/tenants/bad');
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /admin/tenants/:id ───────────────────────────────────────────

describe('PATCH /admin/tenants/:id', () => {
  it('updates tenant and returns updated info', async () => {
    const { app, tenantDb } = createTestApp();
    const res = await app.request('/api/v1/admin/tenants/t1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated', quotaRows: 200000 }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('Updated');
    expect(tenantDb.updateTenant).toHaveBeenCalledWith('t1', { name: 'Updated', quotaRows: 200000 });
  });

  it('returns 404 when tenant not found', async () => {
    const tenantDb = mockTenantDb({ updateTenant: vi.fn().mockResolvedValue(null) });
    const { app } = createTestApp(tenantDb);
    const res = await app.request('/api/v1/admin/tenants/bad', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /admin/tenants/:id ──────────────────────────────────────────

describe('DELETE /admin/tenants/:id', () => {
  it('deletes tenant and returns success', async () => {
    const { app, tenantDb } = createTestApp();
    const res = await app.request('/api/v1/admin/tenants/t1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(tenantDb.deleteTenant).toHaveBeenCalledWith('t1');
  });

  it('returns 404 when tenant not found', async () => {
    const tenantDb = mockTenantDb({ deleteTenant: vi.fn().mockResolvedValue(false) });
    const { app } = createTestApp(tenantDb);
    const res = await app.request('/api/v1/admin/tenants/bad', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// ─── POST /admin/tenants/:id/regenerate-key ─────────────────────────────

describe('POST /admin/tenants/:id/regenerate-key', () => {
  it('regenerates key and returns new key', async () => {
    const { app } = createTestApp();
    const res = await app.request('/api/v1/admin/tenants/t1/regenerate-key', { method: 'POST' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tenantId).toBe('t1');
    expect(json.apiKey).toBe('sk_live_newkey');
    expect(json.message).toContain('regenerated');
  });

  it('returns 404 when tenant not found', async () => {
    const tenantDb = mockTenantDb({ regenerateApiKey: vi.fn().mockResolvedValue(null) });
    const { app } = createTestApp(tenantDb);
    const res = await app.request('/api/v1/admin/tenants/bad/regenerate-key', { method: 'POST' });
    expect(res.status).toBe(404);
  });
});
