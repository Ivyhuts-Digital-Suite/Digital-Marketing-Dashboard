/**
 * Permission catalog. Code checks permissions, never role names, so roles can be
 * reshaped (or made customizable per organization) without touching business logic.
 */
export const PERMISSIONS = {
  // Organization management
  ORGANIZATION_READ: 'organization:read',
  ORGANIZATION_UPDATE: 'organization:update',
  ORGANIZATION_ARCHIVE: 'organization:archive',

  // User / membership management
  MEMBERS_READ: 'members:read',
  MEMBERS_INVITE: 'members:invite',
  MEMBERS_UPDATE_ROLE: 'members:update_role',
  MEMBERS_REMOVE: 'members:remove',

  // Advertising integrations
  INTEGRATIONS_READ: 'integrations:read',
  INTEGRATIONS_MANAGE: 'integrations:manage',

  // Campaigns
  CAMPAIGNS_READ: 'campaigns:read',
  CAMPAIGNS_UPDATE: 'campaigns:update',
  CAMPAIGNS_BUDGET_UPDATE: 'campaigns:budget_update',
  CAMPAIGNS_PAUSE_RESUME: 'campaigns:pause_resume',
  /** Reserved for a future milestone. Not granted to any role; no endpoint exists. */
  CAMPAIGNS_CREATE: 'campaigns:create',

  // Leads & CRM
  LEADS_READ: 'leads:read',
  LEADS_MANAGE: 'leads:manage',
  CRM_READ: 'crm:read',
  CRM_MANAGE: 'crm:manage',

  // AI
  AI_ANALYZE: 'ai:analyze',
  AI_RECOMMENDATIONS_READ: 'ai:recommendations_read',
  AI_EXECUTE: 'ai:execute',

  // Reports
  REPORTS_READ: 'reports:read',
  REPORTS_MANAGE: 'reports:manage',

  // Audit
  AUDIT_READ: 'audit:read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

/** Permissions that exist in the catalog but are intentionally not grantable yet. */
export const RESERVED_PERMISSIONS: readonly Permission[] = [PERMISSIONS.CAMPAIGNS_CREATE];

export const GRANTABLE_PERMISSIONS = ALL_PERMISSIONS.filter((p) => !RESERVED_PERMISSIONS.includes(p));
