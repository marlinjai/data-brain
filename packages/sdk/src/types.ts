export interface DataBrainConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface TenantInfo {
  id: string;
  name: string;
  quotaRows: number;
  usedRows: number;
  maxTables: number;
  createdAt: string;
}

export interface BatchOperation {
  method: string;
  params: Record<string, unknown>;
}

export interface BatchResult {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}
