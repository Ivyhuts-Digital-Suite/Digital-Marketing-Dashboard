import type { z } from 'zod';
import { ApiError } from './api-client';

/** Client-side validation with the same Zod schemas the API uses. */
export function validateForm<S extends z.ZodType>(
  schema: S,
  values: unknown,
): { data: z.output<S>; errors: null } | { data: null; errors: Record<string, string> } {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data, errors: null };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'form';
    errors[key] ??= issue.message;
  }
  return { data: null, errors };
}

/** Field errors from an API validation response, plus a form-level message. */
export function apiFormErrors(error: unknown): { fields: Record<string, string>; message: string } {
  if (error instanceof ApiError) {
    return { fields: error.code === 'VALIDATION_ERROR' ? error.fieldErrors() : {}, message: error.message };
  }
  return { fields: {}, message: 'Something went wrong. Please try again.' };
}
