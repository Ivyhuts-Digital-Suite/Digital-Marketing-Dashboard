import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ERROR_CODES } from '@mp/shared';
import type { ApiFailure } from '@mp/types';
import type { Logger } from '../lib/logger';
import { AppError, Errors } from '../lib/errors';

interface HttpParserError {
  type?: string;
  status?: number;
}

function normalize(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const parser = error as HttpParserError;
  if (parser?.type === 'entity.too.large') {
    return new AppError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, 'Request body is too large');
  }
  if (parser?.type === 'entity.parse.failed') return Errors.badRequest('Malformed JSON body');
  if (parser?.type && parser.status && parser.status >= 400 && parser.status < 500) {
    return Errors.badRequest('Unsupported request body');
  }

  if (error instanceof mongoose.Error.CastError) return Errors.badRequest('Invalid identifier');
  if (error instanceof mongoose.Error.ValidationError) {
    return Errors.validation(
      Object.values(error.errors).map((issue) => ({ path: `body.${issue.path}`, message: issue.message })),
    );
  }
  if ((error as { code?: number })?.code === 11000) return Errors.conflict('Resource already exists');

  return new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'An unexpected error occurred');
}

/**
 * Converts every error into the standard failure envelope. Only AppError messages reach
 * clients; unexpected errors are logged with full detail and returned as a generic 500,
 * so stack traces and database errors are never exposed.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, _next) => {
    const appError = normalize(error);

    if (appError.status >= 500) {
      logger.error({ err: error, requestId: req.id }, 'Unhandled request error');
    }
    if (res.headersSent) return;

    const body: ApiFailure = {
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details && { details: appError.details }),
        requestId: String(req.id),
      },
    };
    res.status(appError.status).json(body);
  };
}

export const notFoundHandler: RequestHandler = (req) => {
  throw Errors.notFound(`Route ${req.method} ${req.path}`);
};
