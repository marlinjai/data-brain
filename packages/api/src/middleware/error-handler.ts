import { ApiError, createErrorHandler } from '@marlinjai/brain-core';
import type { AppEnv } from '../env';

// Re-export ApiError so existing imports continue to work
export { ApiError };

/**
 * Global error handler for Hono
 */
export const errorHandler = createErrorHandler<AppEnv>();
