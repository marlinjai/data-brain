import {
  BrainSdkError,
  AuthenticationError as BaseAuthenticationError,
  NotFoundError as BaseNotFoundError,
  ValidationError as BaseValidationError,
  QuotaExceededError as BaseQuotaExceededError,
  NetworkError as BaseNetworkError,
  ConflictError as BaseConflictError,
} from '@marlinjai/brain-core/sdk';

/**
 * Base error class for Data Brain SDK — extends BrainSdkError
 */
export class DataBrainError extends BrainSdkError {
  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message, code, statusCode, details);
    this.name = 'DataBrainError';
  }
}

/**
 * Authentication error - invalid or missing API key
 */
export class AuthenticationError extends BaseAuthenticationError {}

/**
 * Resource not found error
 */
export class NotFoundError extends BaseNotFoundError {}

/**
 * Validation error - request validation failed
 */
export class ValidationError extends BaseValidationError {}

/**
 * Quota exceeded error
 */
export class QuotaExceededError extends BaseQuotaExceededError {}

/**
 * Conflict error
 */
export class ConflictError extends BaseConflictError {}

/**
 * Network error - connection issues
 */
export class NetworkError extends BaseNetworkError {}

/**
 * Batch error - domain-specific to Data Brain
 */
export class BatchError extends DataBrainError {
  constructor(
    message: string,
    public results: Array<{ success: boolean; data?: unknown; error?: { code: string; message: string } }>
  ) {
    super(message, 'BATCH_ERROR', undefined, { results });
    this.name = 'BatchError';
  }
}

/**
 * Parse API error response into appropriate error class
 */
export function parseApiError(
  statusCode: number,
  response: { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
): DataBrainError {
  const { code, message, details } = response.error ?? {};
  switch (code) {
    case 'UNAUTHORIZED':
      return new AuthenticationError(message) as unknown as DataBrainError;
    case 'NOT_FOUND':
      return new NotFoundError(message) as unknown as DataBrainError;
    case 'VALIDATION_ERROR':
      return new ValidationError(
        message ?? 'Validation failed',
        details?.errors as Array<{ path: string; message: string }>
      ) as unknown as DataBrainError;
    case 'QUOTA_EXCEEDED':
      return new QuotaExceededError(message) as unknown as DataBrainError;
    case 'CONFLICT':
      return new ConflictError(message ?? 'Conflict') as unknown as DataBrainError;
    default:
      return new DataBrainError(
        message ?? 'An error occurred',
        code ?? 'UNKNOWN_ERROR',
        statusCode,
        details
      );
  }
}
