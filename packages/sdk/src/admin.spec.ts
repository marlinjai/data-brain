import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataBrainAdmin } from './admin';
import { DataBrainError, NetworkError } from './errors';

// ─── Mock fetch ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function errorResponse(status: number, error: { code: string; message: string }) {
  return Promise.resolve(new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

const BASE_URL = 'https://test.example.com';
const ADMIN_KEY = 'admin_secret_key';

function createAdmin(opts?: Partial<{ maxRetries: number }>) {
  return new DataBrainAdmin({
    adminApiKey: ADMIN_KEY,
    baseUrl: BASE_URL,
    timeout: 5000,
    maxRetries: opts?.maxRetries ?? 1,
  });
}

// ─── Constructor ────────────────────────────────────────────────────────

describe('DataBrainAdmin constructor', () => {
  it('throws if adminApiKey is missing', () => {
    expect(() => new DataBrainAdmin({ adminApiKey: '' })).toThrow('Admin API key is required');
  });

  it('strips trailing slash from baseUrl', () => {
    const admin = new DataBrainAdmin({ adminApiKey: 'key', baseUrl: 'https://x.com/' });
    mockFetch.mockResolvedValue(jsonResponse({ tenants: [], nextCursor: null, total: 0 }));
    admin.listTenants();
  });
});

// ─── createTenant ───────────────────────────────────────────────────────

describe('createTenant', () => {
  it('sends POST to /admin/tenants', async () => {
    const admin = createAdmin();
    const result = { tenant: { id: 't1', name: 'Test' }, apiKey: 'sk_live_xxx' };
    mockFetch.mockResolvedValue(jsonResponse(result, 201));
    const res = await admin.createTenant({ name: 'Test' });
    expect(res).toEqual(result);
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/api/v1/admin/tenants`);
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe(`Bearer ${ADMIN_KEY}`);
  });
});

// ─── listTenants ────────────────────────────────────────────────────────

describe('listTenants', () => {
  it('sends GET to /admin/tenants', async () => {
    const admin = createAdmin();
    const result = { tenants: [], nextCursor: null, total: 0 };
    mockFetch.mockResolvedValue(jsonResponse(result));
    const res = await admin.listTenants();
    expect(res).toEqual(result);
    expect(mockFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/admin/tenants`);
  });

  it('includes pagination params', async () => {
    const admin = createAdmin();
    mockFetch.mockResolvedValue(jsonResponse({ tenants: [], nextCursor: null, total: 0 }));
    await admin.listTenants({ limit: 10, cursor: 'abc' });
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('limit=10');
    expect(url).toContain('cursor=abc');
  });
});

// ─── getTenant ──────────────────────────────────────────────────────────

describe('getTenant', () => {
  it('sends GET to /admin/tenants/:id', async () => {
    const admin = createAdmin();
    const detail = { id: 't1', name: 'Test', quota: { quotaRows: 100000, usedRows: 50, availableRows: 99950, usagePercent: 0.05 } };
    mockFetch.mockResolvedValue(jsonResponse(detail));
    const res = await admin.getTenant('t1');
    expect(res).toEqual(detail);
    expect(mockFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/admin/tenants/t1`);
  });
});

// ─── updateTenant ───────────────────────────────────────────────────────

describe('updateTenant', () => {
  it('sends PATCH to /admin/tenants/:id', async () => {
    const admin = createAdmin();
    const updated = { id: 't1', name: 'Updated' };
    mockFetch.mockResolvedValue(jsonResponse(updated));
    const res = await admin.updateTenant('t1', { name: 'Updated' });
    expect(res).toEqual(updated);
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/api/v1/admin/tenants/t1`);
    expect(opts.method).toBe('PATCH');
  });
});

// ─── deleteTenant ───────────────────────────────────────────────────────

describe('deleteTenant', () => {
  it('sends DELETE to /admin/tenants/:id', async () => {
    const admin = createAdmin();
    mockFetch.mockResolvedValue(jsonResponse({ success: true }));
    await admin.deleteTenant('t1');
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/api/v1/admin/tenants/t1`);
    expect(opts.method).toBe('DELETE');
  });
});

// ─── regenerateKey ──────────────────────────────────────────────────────

describe('regenerateKey', () => {
  it('sends POST to /admin/tenants/:id/regenerate-key', async () => {
    const admin = createAdmin();
    const result = { tenantId: 't1', apiKey: 'sk_live_new', message: 'API key regenerated successfully. Store this key securely.' };
    mockFetch.mockResolvedValue(jsonResponse(result));
    const res = await admin.regenerateKey('t1');
    expect(res).toEqual(result);
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/api/v1/admin/tenants/t1/regenerate-key`);
    expect(opts.method).toBe('POST');
  });
});

// ─── Error handling ─────────────────────────────────────────────────────

describe('error handling', () => {
  it('does not retry on 4xx errors', async () => {
    const admin = createAdmin({ maxRetries: 3 });
    mockFetch.mockResolvedValue(errorResponse(404, { code: 'NOT_FOUND', message: 'Tenant not found' }));
    await expect(admin.getTenant('bad')).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('throws NetworkError on repeated failures', async () => {
    const admin = createAdmin({ maxRetries: 1 });
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(admin.listTenants()).rejects.toThrow(NetworkError);
  });
});

// ─── Headers ────────────────────────────────────────────────────────────

describe('request headers', () => {
  it('sends Bearer token with admin key', async () => {
    const admin = createAdmin();
    mockFetch.mockResolvedValue(jsonResponse({ tenants: [], nextCursor: null, total: 0 }));
    await admin.listTenants();
    const headers = mockFetch.mock.calls[0]![1].headers;
    expect(headers.Authorization).toBe(`Bearer ${ADMIN_KEY}`);
    expect(headers['Content-Type']).toBe('application/json');
  });
});
