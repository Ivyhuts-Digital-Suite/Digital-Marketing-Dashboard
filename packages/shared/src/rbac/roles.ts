/**
 * SUPER_ADMIN is a platform role stored on the user (User.platformRole). It is never
 * assignable through organization membership APIs. All other roles are organization roles.
 */
export const PLATFORM_ROLES = ['SUPER_ADMIN', 'USER'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ORGANIZATION_ROLES = [
  'ORGANIZATION_OWNER',
  'ADMIN',
  'MARKETING_MANAGER',
  'MARKETING_ANALYST',
  'SALES_MANAGER',
  'SALES_REPRESENTATIVE',
  'VIEWER',
] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const ROLES = ['SUPER_ADMIN', ...ORGANIZATION_ROLES] as const;
export type Role = (typeof ROLES)[number];

/**
 * Authority rank used for role-assignment rules (who may grant or modify which role).
 * Peer functional roles (marketing vs sales managers) share a rank.
 */
export const ROLE_RANK: Record<OrganizationRole, number> = {
  ORGANIZATION_OWNER: 100,
  ADMIN: 80,
  MARKETING_MANAGER: 60,
  SALES_MANAGER: 60,
  MARKETING_ANALYST: 40,
  SALES_REPRESENTATIVE: 40,
  VIEWER: 10,
};

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORGANIZATION_OWNER: 'Owner',
  ADMIN: 'Admin',
  MARKETING_MANAGER: 'Marketing Manager',
  MARKETING_ANALYST: 'Marketing Analyst',
  SALES_MANAGER: 'Sales Manager',
  SALES_REPRESENTATIVE: 'Sales Representative',
  VIEWER: 'Viewer',
};
