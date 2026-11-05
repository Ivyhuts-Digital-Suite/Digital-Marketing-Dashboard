import { z } from 'zod';
import { PASSWORD_POLICY } from '@mp/shared';
import { emailSchema, passwordSchema, personNameSchema } from './common';

export const registerSchema = z
  .object({
    name: personNameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

/** Login only bounds the password length; policy checks apply at registration. */
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(PASSWORD_POLICY.MAX_LENGTH),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
