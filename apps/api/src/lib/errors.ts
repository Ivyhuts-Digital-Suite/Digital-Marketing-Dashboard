import { ERROR_CODES, type ErrorCode } from '@mp/shared';
import type { ValidationIssue } from '@mp/types';

/**
 * Operational error with a safe, client-facing message. Anything that is not an AppError
 * is treated as an unexpected failure and reported to clients as INTERNAL_ERROR.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ValidationIssue[] | undefined;

  constructor(status: number, code: ErrorCode, message: string, details?: ValidationIssue[]) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  validation: (details: ValidationIssue[], message = 'The request is invalid') =>
    new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, details),
  badRequest: (message: string) => new AppError(400, ERROR_CODES.BAD_REQUEST, message),
  unauthenticated: (message = 'Authentication is required') =>
    new AppError(401, ERROR_CODES.UNAUTHENTICATED, message),
  tokenExpired: () => new AppError(401, ERROR_CODES.TOKEN_EXPIRED, 'Access token has expired'),
  invalidCredentials: () => new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password'),
  accountLocked: () =>
    new AppError(423, ERROR_CODES.ACCOUNT_LOCKED, 'Too many failed sign-in attempts. Try again later.'),
  accountDisabled: () => new AppError(403, ERROR_CODES.ACCOUNT_DISABLED, 'This account is not active'),
  forbidden: (message = 'You do not have permission to perform this action') =>
    new AppError(403, ERROR_CODES.FORBIDDEN, message),
  organizationRequired: () =>
    new AppError(
      400,
      ERROR_CODES.ORGANIZATION_REQUIRED,
      'An organization context is required. Send the X-Organization-Id header.',
    ),
  organizationAccessDenied: () =>
    new AppError(403, ERROR_CODES.ORGANIZATION_ACCESS_DENIED, 'You do not have access to this organization'),
  notFound: (resource = 'Resource') => new AppError(404, ERROR_CODES.NOT_FOUND, `${resource} not found`),
  conflict: (message: string) => new AppError(409, ERROR_CODES.CONFLICT, message),
  rateLimited: () => new AppError(429, ERROR_CODES.RATE_LIMITED, 'Too many requests. Please slow down.'),
  notImplemented: (message: string) => new AppError(501, ERROR_CODES.NOT_IMPLEMENTED, message),
  serviceUnavailable: (message = 'Service temporarily unavailable') =>
    new AppError(503, ERROR_CODES.SERVICE_UNAVAILABLE, message),
};
