import type { Context, Next } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from './error-handler';
import { apiKeySchema } from '@data-brain/shared';

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) throw ApiError.unauthorized('Missing Authorization header');
  if (!authHeader.startsWith('Bearer ')) throw ApiError.unauthorized('Invalid Authorization header format');

  const apiKey = authHeader.slice(7);
  const parseResult = apiKeySchema.safeParse(apiKey);
  if (!parseResult.success) throw ApiError.unauthorized('Invalid API key format');

  const keyHash = await hashApiKey(apiKey);

  const row = await c.env.DB.prepare(
    'SELECT id, name, api_key_hash, quota_rows, used_rows, max_tables, created_at, updated_at FROM tenants WHERE api_key_hash = ?'
  ).bind(keyHash).first();

  if (!row) throw ApiError.unauthorized('Invalid API key');

  c.set('tenant', {
    id: row.id as string,
    name: row.name as string,
    apiKeyHash: row.api_key_hash as string,
    quotaRows: row.quota_rows as number,
    usedRows: row.used_rows as number,
    maxTables: row.max_tables as number,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  });

  await next();
}

export async function adminAuthMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw ApiError.unauthorized('Missing admin key');

  const key = authHeader.slice(7);
  if (!c.env.ADMIN_API_KEY || key !== c.env.ADMIN_API_KEY) {
    throw ApiError.unauthorized('Invalid admin key');
  }

  await next();
}

export { hashApiKey };
