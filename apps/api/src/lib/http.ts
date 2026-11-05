import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { ApiMeta, ApiSuccess, PaginationMeta, ValidationIssue } from '@mp/types';
import { Errors } from './errors';

export function sendSuccess<T>(res: Response, data: T, options: { status?: number; meta?: ApiMeta } = {}): void {
  const body: ApiSuccess<T> = { success: true, data, ...(options.meta && { meta: options.meta }) };
  res.status(options.status ?? 200).json(body);
}

export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

type RequestPart = 'body' | 'query' | 'params';

export function toValidationIssues(part: RequestPart, error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: [part, ...issue.path.map(String)].join('.'),
    message: issue.message,
  }));
}

function parsePart<S extends z.ZodType>(part: RequestPart, schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value ?? {});
  if (!result.success) throw Errors.validation(toValidationIssues(part, result.error));
  return result.data;
}

/** Validates and returns typed request input. Throws a 400 VALIDATION_ERROR on failure. */
export const input = {
  body: <S extends z.ZodType>(req: Request, schema: S) => parsePart('body', schema, req.body),
  query: <S extends z.ZodType>(req: Request, schema: S) => parsePart('query', schema, req.query),
  params: <S extends z.ZodType>(req: Request, schema: S) => parsePart('params', schema, req.params),
};

/** Normalized client IP (Express honours the configured `trust proxy` setting). */
export function clientIp(req: Request): string | null {
  return req.ip ?? req.socket.remoteAddress ?? null;
}
