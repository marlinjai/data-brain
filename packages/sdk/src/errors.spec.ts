import { describe, it, expect } from 'vitest';
import {
  DataBrainError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  QuotaExceededError,
  ConflictError,
  NetworkError,
  BatchError,
  parseApiError,
} from './errors';

describe('DataBrainError', () => {
  it('stores message, code, statusCode, details', () => {
    const err = new DataBrainError('bad', 'BAD', 400, { field: 'x' });
    expect(err.message).toBe('bad');
    expect(err.code).toBe('BAD');
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: 'x' });
    expect(err.name).toBe('DataBrainError');
  });

  it('is an instance of Error', () => {
    expect(new DataBrainError('x', 'X')).toBeInstanceOf(Error);
  });
});

describe('specific error classes', () => {
  it('AuthenticationError', () => {
    const err = new AuthenticationError();
    expect(err.code).toBe('AUTHENTICATION_ERROR');
    expect(err.statusCode).toBe(401);
  });

  it('NotFoundError', () => {
    const err = new NotFoundError('gone');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('ValidationError', () => {
    const err = new ValidationError('invalid', [{ path: 'name', message: 'required' }]);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
  });

  it('QuotaExceededError', () => {
    const err = new QuotaExceededError();
    expect(err.code).toBe('QUOTA_EXCEEDED');
    expect(err.statusCode).toBe(403);
  });

  it('ConflictError', () => {
    const err = new ConflictError('dup');
    expect(err.code).toBe('CONFLICT');
    expect(err.statusCode).toBe(409);
  });

  it('NetworkError', () => {
    const cause = new Error('timeout');
    const err = new NetworkError('fail', cause);
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.originalError).toBe(cause);
  });
});

describe('BatchError', () => {
  it('stores results', () => {
    const results = [
      { success: true, data: { id: '1' } },
      { success: false, error: { code: 'NOT_FOUND', message: 'nope' } },
    ];
    const err = new BatchError('partial failure', results);
    expect(err.results).toBe(results);
    expect(err.code).toBe('BATCH_ERROR');
    expect(err.name).toBe('BatchError');
  });
});

describe('parseApiError', () => {
  it('returns AuthenticationError for UNAUTHORIZED', () => {
    const err = parseApiError(401, { error: { code: 'UNAUTHORIZED', message: 'bad key' } });
    expect(err).toBeInstanceOf(Error);
    // parseApiError creates an AuthenticationError which has code 'AUTHENTICATION_ERROR'
    expect(err.code ?? (err as any).code).toBe('AUTHENTICATION_ERROR');
  });

  it('returns NotFoundError for NOT_FOUND', () => {
    const err = parseApiError(404, { error: { code: 'NOT_FOUND', message: 'not here' } });
    expect(err.code ?? (err as any).code).toBe('NOT_FOUND');
  });

  it('returns ValidationError for VALIDATION_ERROR', () => {
    const err = parseApiError(400, {
      error: { code: 'VALIDATION_ERROR', message: 'bad input', details: { errors: [] } },
    });
    expect(err.code ?? (err as any).code).toBe('VALIDATION_ERROR');
  });

  it('returns QuotaExceededError for QUOTA_EXCEEDED', () => {
    const err = parseApiError(429, { error: { code: 'QUOTA_EXCEEDED', message: 'limit' } });
    expect(err.code ?? (err as any).code).toBe('QUOTA_EXCEEDED');
  });

  it('returns ConflictError for CONFLICT', () => {
    const err = parseApiError(409, { error: { code: 'CONFLICT', message: 'dup' } });
    expect(err.code ?? (err as any).code).toBe('CONFLICT');
  });

  it('returns generic DataBrainError for unknown code', () => {
    const err = parseApiError(500, { error: { code: 'INTERNAL', message: 'boom' } });
    expect(err).toBeInstanceOf(DataBrainError);
    expect(err.code).toBe('INTERNAL');
    expect(err.statusCode).toBe(500);
  });

  it('handles empty error object', () => {
    const err = parseApiError(500, {});
    expect(err).toBeInstanceOf(DataBrainError);
    expect(err.message).toBe('An error occurred');
  });
});
