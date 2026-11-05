export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

/** Header carrying the active organization for tenant-scoped requests. */
export const ORGANIZATION_HEADER = 'x-organization-id';
export const REQUEST_ID_HEADER = 'x-request-id';

export const AUTH_COOKIES = {
  ACCESS: 'mp_access',
  REFRESH: 'mp_refresh',
  /**
   * Non-sensitive presence flag ("1") readable by the web server's proxy for optimistic
   * redirects. It grants nothing: every API request is authenticated independently.
   */
  SESSION_HINT: 'mp_session',
} as const;

export const PASSWORD_POLICY = {
  MIN_LENGTH: 12,
  MAX_LENGTH: 128,
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 25,
  MAX_LIMIT: 100,
} as const;

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ORGANIZATION_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const MEMBERSHIP_STATUSES = ['ACTIVE', 'SUSPENDED', 'REMOVED'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const INVITATION_TTL_DAYS = 7;
