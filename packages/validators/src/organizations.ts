import { z } from 'zod';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES, ORGANIZATION_ROLES } from '@mp/shared';
import { emailSchema, objectIdSchema, paginationQuerySchema } from './common';

const isValidTimezone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, 'Organization name must be at least 2 characters')
  .max(100, 'Organization name must be at most 100 characters');

export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Slug must be at least 3 characters')
  .max(48, 'Slug must be at most 48 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, numbers and single hyphens');

export const timezoneSchema = z.string().trim().refine(isValidTimezone, 'Must be a valid IANA timezone');
export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO 4217 currency code');

export const createOrganizationSchema = z
  .object({
    name: organizationNameSchema,
    slug: organizationSlugSchema.optional(),
    timezone: timezoneSchema.default('UTC'),
    currency: currencySchema.default('USD'),
  })
  .strict();

export const updateOrganizationSchema = z
  .object({
    name: organizationNameSchema.optional(),
    timezone: timezoneSchema.optional(),
    currency: currencySchema.optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((v) => v !== undefined), 'Provide at least one field to update');

export const organizationIdParamSchema = z.object({ organizationId: objectIdSchema }).strict();

export const organizationRoleSchema = z.enum(ORGANIZATION_ROLES);

export const updateMemberRoleSchema = z.object({ role: organizationRoleSchema }).strict();

export const createInvitationSchema = z
  .object({
    email: emailSchema,
    role: organizationRoleSchema,
  })
  .strict();

export const acceptInvitationSchema = z
  .object({
    token: z
      .string()
      .min(32, 'Invalid invitation token')
      .max(128, 'Invalid invitation token')
      .regex(/^[A-Za-z0-9_-]+$/, 'Invalid invitation token'),
  })
  .strict();

export const listAuditLogsQuerySchema = paginationQuerySchema
  .extend({
    action: z.enum(Object.values(AUDIT_ACTIONS) as [string, ...string[]]).optional(),
    resourceType: z.enum(AUDIT_RESOURCE_TYPES).optional(),
    since: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
