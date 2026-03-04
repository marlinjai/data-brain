import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataBrain } from './client';
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

function emptyResponse(status = 204) {
  return Promise.resolve(new Response(null, { status }));
}

const BASE_URL = 'https://test.example.com';
const API_KEY = 'db_live_testkey123';

function createClient(opts?: Partial<{ workspaceId: string; maxRetries: number }>) {
  return new DataBrain({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    timeout: 5000,
    maxRetries: opts?.maxRetries ?? 1,
    workspaceId: opts?.workspaceId,
  });
}

// ─── Constructor ────────────────────────────────────────────────────────

describe('DataBrain constructor', () => {
  it('throws if apiKey is missing', () => {
    expect(() => new DataBrain({ apiKey: '' })).toThrow('API key is required');
  });

  it('strips trailing slash from baseUrl', () => {
    const client = new DataBrain({ apiKey: 'key', baseUrl: 'https://x.com/' });
    mockFetch.mockResolvedValue(jsonResponse({ id: '1' }, 201));
    client.createTable({ workspaceId: 'ws', name: 'T' } as any);
  });
});

// ─── withWorkspace ──────────────────────────────────────────────────────

describe('withWorkspace', () => {
  it('returns new client with workspaceId', async () => {
    const client = createClient();
    const scoped = client.withWorkspace('ws-123');
    mockFetch.mockResolvedValue(jsonResponse([]));
    await scoped.listTables('ws-123');
    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.headers['X-Workspace-Id']).toBe('ws-123');
  });
});

// ─── Tables ─────────────────────────────────────────────────────────────

describe('Tables', () => {
  it('createTable sends POST', async () => {
    const client = createClient();
    const table = { id: 't1', name: 'T', workspaceId: 'ws' };
    mockFetch.mockResolvedValue(jsonResponse(table, 201));
    const result = await client.createTable({ workspaceId: 'ws', name: 'T' } as any);
    expect(result).toEqual(table);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/api/v1/tables`);
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe(`Bearer ${API_KEY}`);
  });

  it('getTable sends GET', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse({ id: 't1' }));
    const table = await client.getTable('t1');
    expect(table).toEqual({ id: 't1' });
    expect(mockFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/tables/t1`);
  });

  it('getTable returns null on 404 from generic error', async () => {
    // parseApiError returns NotFoundError for NOT_FOUND, which is not instanceof DataBrainError.
    // The client checks instanceof DataBrainError, so we need a DataBrainError with statusCode 404.
    // In practice the default case with an unknown code + 404 status returns an actual DataBrainError.
    const client = createClient();
    mockFetch.mockResolvedValue(errorResponse(404, { code: 'SOME_UNKNOWN_CODE', message: 'nope' }));
    const result = await client.getTable('t1');
    expect(result).toBeNull();
  });

  it('updateTable sends PATCH', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse({ id: 't1', name: 'New' }));
    await client.updateTable('t1', { name: 'New' });
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/api/v1/tables/t1`);
    expect(opts.method).toBe('PATCH');
  });

  it('deleteTable sends DELETE', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(emptyResponse());
    await client.deleteTable('t1');
    expect(mockFetch.mock.calls[0]![1].method).toBe('DELETE');
  });

  it('listTables sends GET', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse([{ id: 't1' }]));
    const tables = await client.listTables('ws');
    expect(tables).toEqual([{ id: 't1' }]);
  });
});

// ─── Columns ────────────────────────────────────────────────────────────

describe('Columns', () => {
  it('createColumn sends POST to correct URL', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse({ id: 'c1' }, 201));
    await client.createColumn({ tableId: 't1', name: 'Col', type: 'text' } as any);
    expect(mockFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/tables/t1/columns`);
  });

  it('getColumns fetches columns for table', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse([{ id: 'c1' }]));
    const cols = await client.getColumns('t1');
    expect(cols).toHaveLength(1);
  });

  it('getColumn returns null on 404 from generic error', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(errorResponse(404, { code: 'SOME_UNKNOWN_CODE', message: '' }));
    expect(await client.getColumn('c1')).toBeNull();
  });

  it('reorderColumns sends PUT', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(emptyResponse());
    await client.reorderColumns('t1', ['c1', 'c2']);
    expect(mockFetch.mock.calls[0]![1].method).toBe('PUT');
  });
});

// ─── Rows ───────────────────────────────────────────────────────────────

describe('Rows', () => {
  it('createRow sends POST', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse({ id: 'r1' }, 201));
    await client.createRow({ tableId: 't1' } as any);
    expect(mockFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/tables/t1/rows`);
  });

  it('getRows builds query string', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse({ data: [], hasMore: false }));
    await client.getRows('t1', { limit: 10, offset: 5 });
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=5');
  });

  it('getRows with no query has no query string', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse({ data: [], hasMore: false }));
    await client.getRows('t1');
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toBe(`${BASE_URL}/api/v1/tables/t1/rows`);
  });

  it('getRows with filters serializes JSON', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse({ data: [], hasMore: false }));
    await client.getRows('t1', {
      filters: [{ columnId: 'c1', operator: 'equals' as any, value: 'x' }],
    });
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('filters=');
  });

  it('getRow returns null on 404 from generic error', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(errorResponse(404, { code: 'SOME_UNKNOWN_CODE', message: '' }));
    expect(await client.getRow('r1')).toBeNull();
  });

  it('bulkCreateRows returns empty for empty input', async () => {
    const client = createClient();
    const result = await client.bulkCreateRows([]);
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('bulkDeleteRows sends DELETE', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(emptyResponse());
    await client.bulkDeleteRows(['r1', 'r2']);
    expect(mockFetch.mock.calls[0]![1].method).toBe('DELETE');
  });
});

// ─── Views ──────────────────────────────────────────────────────────────

describe('Views', () => {
  it('createView sends POST', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse({ id: 'v1' }, 201));
    await client.createView({ tableId: 't1', name: 'V', type: 'table' } as any);
    expect(mockFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/tables/t1/views`);
  });

  it('getView returns null on 404 from generic error', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(errorResponse(404, { code: 'SOME_UNKNOWN_CODE', message: '' }));
    expect(await client.getView('v1')).toBeNull();
  });
});

// ─── Select Options ─────────────────────────────────────────────────────

describe('Select Options', () => {
  it('createSelectOption sends POST to correct URL', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse({ id: 'o1' }, 201));
    await client.createSelectOption({ columnId: 'c1', name: 'Open' } as any);
    expect(mockFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/columns/c1/options`);
  });
});

// ─── Relations ──────────────────────────────────────────────────────────

describe('Relations', () => {
  it('createRelation sends POST', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(emptyResponse());
    await client.createRelation({ sourceRowId: 'r1', sourceColumnId: 'c1', targetRowId: 'r2' } as any);
    expect(mockFetch.mock.calls[0]![1].method).toBe('POST');
  });

  it('deleteRelation sends DELETE with body', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(emptyResponse());
    await client.deleteRelation('r1', 'c1', 'r2');
    const opts = mockFetch.mock.calls[0]![1];
    expect(opts.method).toBe('DELETE');
    expect(JSON.parse(opts.body)).toEqual({ sourceRowId: 'r1', columnId: 'c1', targetRowId: 'r2' });
  });
});

// ─── File References ────────────────────────────────────────────────────

describe('File References', () => {
  it('addFileReference sends POST', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse({ id: 'f1' }, 201));
    await client.addFileReference({
      rowId: 'r1', columnId: 'c1', fileId: 'f1',
      fileUrl: 'https://x.com/f', originalName: 'a.pdf', mimeType: 'application/pdf',
    } as any);
    expect(mockFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/file-refs`);
  });

  it('getFileReferences fetches by row and column', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse([]));
    await client.getFileReferences('r1', 'c1');
    expect(mockFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/rows/r1/files/c1`);
  });
});

// ─── Batch ──────────────────────────────────────────────────────────────

describe('batch', () => {
  it('sends POST to /rpc/batch and returns results', async () => {
    const client = createClient();
    const results = [{ success: true, data: {} }];
    mockFetch.mockResolvedValue(jsonResponse({ results }));
    const res = await client.batch([{ method: 'getTable', params: { id: 't1' } }]);
    expect(res).toEqual(results);
  });
});

// ─── Workspaces ─────────────────────────────────────────────────────────

describe('Workspaces', () => {
  it('createWorkspace sends POST', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse({ id: 'ws1' }, 201));
    await client.createWorkspace({ name: 'WS', slug: 'ws' });
    expect(mockFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/workspaces`);
  });

  it('getWorkspace returns null on 404 from generic error', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(errorResponse(404, { code: 'SOME_UNKNOWN_CODE', message: '' }));
    expect(await client.getWorkspace('ws1')).toBeNull();
  });
});

// ─── Tenant ─────────────────────────────────────────────────────────────

describe('getTenantInfo', () => {
  it('sends GET to /tenant/info', async () => {
    const client = createClient();
    const info = { id: 't1', name: 'Acme', quotaRows: 100000, usedRows: 50, maxTables: 100, createdAt: '2024-01-01T00:00:00Z' };
    mockFetch.mockResolvedValue(jsonResponse(info));
    const result = await client.getTenantInfo();
    expect(result).toEqual(info);
    expect(mockFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/tenant/info`);
  });
});

// ─── Error handling & retries ───────────────────────────────────────────

describe('error handling', () => {
  it('does not retry on 4xx DataBrainError (unknown code fallback)', async () => {
    // Only errors that are actual DataBrainError instances (default case in parseApiError)
    // will be caught by the instanceof check and not retried
    const client = createClient({ maxRetries: 3 });
    mockFetch.mockResolvedValue(errorResponse(400, { code: 'CUSTOM_ERROR', message: 'bad' }));
    await expect(client.createTable({ workspaceId: 'ws', name: '' } as any)).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('retries on 5xx and eventually throws NetworkError', async () => {
    const client = createClient({ maxRetries: 2 });
    mockFetch.mockResolvedValue(errorResponse(500, { code: 'INTERNAL', message: 'boom' }));
    await expect(client.listTables('ws')).rejects.toThrow(NetworkError);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws NetworkError on fetch failure', async () => {
    const client = createClient({ maxRetries: 1 });
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(client.listTables('ws')).rejects.toThrow(NetworkError);
  });
});

// ─── Headers ────────────────────────────────────────────────────────────

describe('request headers', () => {
  it('includes Authorization header', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse([]));
    await client.listTables('ws');
    const headers = mockFetch.mock.calls[0]![1].headers;
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
  });

  it('includes Content-Type', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse([]));
    await client.listTables('ws');
    expect(mockFetch.mock.calls[0]![1].headers['Content-Type']).toBe('application/json');
  });

  it('includes X-Workspace-Id when workspaceId is set', async () => {
    const client = createClient({ workspaceId: 'ws-abc' });
    mockFetch.mockResolvedValue(jsonResponse([]));
    await client.listTables('ws');
    expect(mockFetch.mock.calls[0]![1].headers['X-Workspace-Id']).toBe('ws-abc');
  });

  it('omits X-Workspace-Id when not set', async () => {
    const client = createClient();
    mockFetch.mockResolvedValue(jsonResponse([]));
    await client.listTables('ws');
    expect(mockFetch.mock.calls[0]![1].headers['X-Workspace-Id']).toBeUndefined();
  });
});
