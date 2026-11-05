import { z } from 'zod';
import { PASSWORD_POLICY } from '@mp/shared';
import { passwordSchema, personNameSchema } from './common';

export const updateProfileSchema = z.object({ name: personNameSchema }).strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(PASSWORD_POLICY.MAX_LENGTH),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'New password must differ from the current password',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
