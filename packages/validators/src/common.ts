import { z } from 'zod';
import { PAGINATION, PASSWORD_POLICY } from '@mp/shared';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid identifier');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Must be a valid email address'));

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters');

/**
 * Length-first password policy (NIST SP 800-63B): at least 12 characters, with a letter
 * and a non-letter so trivially guessable all-alpha passphrases are rejected.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_POLICY.MIN_LENGTH, `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters`)
  .max(PASSWORD_POLICY.MAX_LENGTH, `Password must be at most ${PASSWORD_POLICY.MAX_LENGTH} characters`)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[^A-Za-z]/, 'Password must contain a number or symbol');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
});

export const idParamSchema = z.object({ id: objectIdSchema }).strict();
