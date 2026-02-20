export class DataBrainError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DataBrainError';
  }
}

export class AuthenticationError extends DataBrainError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends DataBrainError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends DataBrainError {
  constructor(message: string, public errors?: Array<{ path: string; message: string }>) {
    super(message, 'VALIDATION_ERROR', 400, { errors });
    this.name = 'ValidationError';
  }
}

export class QuotaExceededError extends DataBrainError {
  constructor(message = 'Quota exceeded') {
    super(message, 'QUOTA_EXCEEDED', 403);
    this.name = 'QuotaExceededError';
  }
}

export class ConflictError extends DataBrainError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class NetworkError extends DataBrainError {
  constructor(message = 'Network error occurred', public originalError?: Error) {
    super(message, 'NETWORK_ERROR', undefined, { originalError: originalError?.message });
    this.name = 'NetworkError';
  }
}

export class BatchError extends DataBrainError {
  constructor(
    message: string,
    public results: Array<{ success: boolean; data?: unknown; error?: { code: string; message: string } }>
  ) {
    super(message, 'BATCH_ERROR', undefined, { results });
    this.name = 'BatchError';
  }
}

export function parseApiError(
  statusCode: number,
  response: { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
): DataBrainError {
  const { code, message, details } = response.error ?? {};
  switch (code) {
    case 'UNAUTHORIZED':
      return new AuthenticationError(message);
    case 'NOT_FOUND':
      return new NotFoundError(message);
    case 'VALIDATION_ERROR':
      return new ValidationError(
        message ?? 'Validation failed',
        details?.errors as Array<{ path: string; message: string }>
      );
    case 'QUOTA_EXCEEDED':
      return new QuotaExceededError(message);
    case 'CONFLICT':
      return new ConflictError(message ?? 'Conflict');
    default:
      return new DataBrainError(
        message ?? 'An error occurred',
        code ?? 'UNKNOWN_ERROR',
        statusCode,
        details
      );
  }
}
