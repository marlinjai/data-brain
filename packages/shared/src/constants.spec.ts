import { describe, it, expect } from 'vitest';
import {
  DEFAULT_QUOTA_ROWS,
  DEFAULT_MAX_TABLES,
  DEFAULT_RATE_LIMIT_PER_MINUTE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  BATCH_METHODS,
} from './constants';

describe('constants', () => {
  it('DEFAULT_QUOTA_ROWS is a positive number', () => {
    expect(DEFAULT_QUOTA_ROWS).toBe(100_000);
  });

  it('DEFAULT_MAX_TABLES is a positive number', () => {
    expect(DEFAULT_MAX_TABLES).toBe(100);
  });

  it('DEFAULT_RATE_LIMIT_PER_MINUTE is a positive number', () => {
    expect(DEFAULT_RATE_LIMIT_PER_MINUTE).toBe(200);
  });

  it('page limits are sane', () => {
    expect(DEFAULT_PAGE_LIMIT).toBe(50);
    expect(MAX_PAGE_LIMIT).toBe(200);
    expect(DEFAULT_PAGE_LIMIT).toBeLessThanOrEqual(MAX_PAGE_LIMIT);
  });

  it('BATCH_METHODS is a non-empty array of strings', () => {
    expect(BATCH_METHODS.length).toBeGreaterThan(0);
    for (const m of BATCH_METHODS) {
      expect(typeof m).toBe('string');
    }
  });

  it('BATCH_METHODS includes expected methods', () => {
    expect(BATCH_METHODS).toContain('createTable');
    expect(BATCH_METHODS).toContain('getRow');
    expect(BATCH_METHODS).toContain('deleteColumn');
    expect(BATCH_METHODS).toContain('createView');
    expect(BATCH_METHODS).toContain('addFileReference');
  });
});
