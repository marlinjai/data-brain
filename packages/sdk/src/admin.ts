import { RETRY_CONFIG } from './constants';
import { DataBrainError, NetworkError, parseApiError } from './errors';
import { BrainSdkError } from '@marlinjai/brain-core/sdk';
import type { TenantInfo } from './types';

const DEFAULT_BASE_URL = 'https://data-brain-api.marlin-pohl.workers.dev';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;

// ============================================================================
// Admin Types
// ============================================================================

export interface DataBrainAdminConfig {
  adminApiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface AdminTenantDetail extends TenantInfo {
  quota: {
    quotaRows: number;
    usedRows: number;
    availableRows: number;
    usagePercent: number;
  };
}

export interface CreateTenantInput {
  name: string;
  quotaRows?: number;
  maxTables?: number;
}

export interface CreateTenantResult {
  tenant: TenantInfo;
  apiKey: string;
}

export interface UpdateTenantInput {
  name?: string;
  quotaRows?: number;
  maxTables?: number;
}

export interface ListTenantsOptions {
  limit?: number;
  cursor?: string;
}

export interface ListTenantsResult {
  tenants: TenantInfo[];
  nextCursor: string | null;
  total: number;
}

export interface RegenerateKeyResult {
  tenantId: string;
  apiKey: string;
  message: string;
}

// ============================================================================
// Admin Client
// ============================================================================

export class DataBrainAdmin {
  private readonly adminApiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(config: DataBrainAdminConfig) {
    if (!config.adminApiKey) {
      throw new DataBrainError('Admin API key is required', 'CONFIGURATION_ERROR');
    }

    this.adminApiKey = config.adminApiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  async createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
    return this.request<CreateTenantResult>('POST', '/api/v1/admin/tenants', input);
  }

  async listTenants(options?: ListTenantsOptions): Promise<ListTenantsResult> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.cursor) params.set('cursor', options.cursor);

    const query = params.toString();
    const path = query ? `/api/v1/admin/tenants?${query}` : '/api/v1/admin/tenants';

    return this.request<ListTenantsResult>('GET', path);
  }

  async getTenant(tenantId: string): Promise<AdminTenantDetail> {
    return this.request<AdminTenantDetail>('GET', `/api/v1/admin/tenants/${tenantId}`);
  }

  async updateTenant(tenantId: string, updates: UpdateTenantInput): Promise<TenantInfo> {
    return this.request<TenantInfo>('PATCH', `/api/v1/admin/tenants/${tenantId}`, updates);
  }

  async deleteTenant(tenantId: string): Promise<void> {
    await this.request<{ success: boolean }>('DELETE', `/api/v1/admin/tenants/${tenantId}`);
  }

  async regenerateKey(tenantId: string): Promise<RegenerateKeyResult> {
    return this.request<RegenerateKeyResult>(
      'POST',
      `/api/v1/admin/tenants/${tenantId}/regenerate-key`
    );
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.adminApiKey}`,
        };

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw parseApiError(
            response.status,
            errorBody as { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof BrainSdkError && error.statusCode && error.statusCode < 500) {
          throw error;
        }

        if (attempt < this.maxRetries - 1) {
          const delay = Math.min(
            RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
            RETRY_CONFIG.maxDelayMs
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new NetworkError(`Request failed after ${this.maxRetries} attempts`, lastError);
  }
}

export default DataBrainAdmin;
