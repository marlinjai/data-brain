export interface DataBrainConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  workspaceId?: string;
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

export interface Workspace {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  quotaRows: number | null;
  usedRows: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
  quotaRows?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkspaceInput {
  name?: string;
  quotaRows?: number | null;
  metadata?: Record<string, unknown>;
}
