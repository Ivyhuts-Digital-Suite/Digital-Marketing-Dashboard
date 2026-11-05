/**
 * Audit action catalog. Actions use `<resource>.<verb>` naming. Add new actions here so
 * the catalog stays the single source of truth for compliance reviews.
 */
export const AUDIT_ACTIONS = {
  AUTH_REGISTER: 'auth.register',
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGIN_FAILED: 'auth.login_failed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_LOGOUT_ALL: 'auth.logout_all',
  AUTH_REFRESH_REUSE_DETECTED: 'auth.refresh_reuse_detected',
  USER_PROFILE_UPDATE: 'user.profile_update',
  USER_PASSWORD_CHANGE: 'user.password_change',
  ORGANIZATION_CREATE: 'organization.create',
  ORGANIZATION_UPDATE: 'organization.update',
  ORGANIZATION_ARCHIVE: 'organization.archive',
  ORGANIZATION_SUPPORT_ACCESS: 'organization.support_access',
  MEMBER_ROLE_UPDATE: 'member.role_update',
  MEMBER_REMOVE: 'member.remove',
  INVITATION_CREATE: 'invitation.create',
  INVITATION_REVOKE: 'invitation.revoke',
  INVITATION_ACCEPT: 'invitation.accept',
  INTEGRATION_DISCONNECT: 'integration.disconnect',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_RESOURCE_TYPES = [
  'User',
  'Session',
  'Organization',
  'OrganizationMember',
  'Invitation',
  'Integration',
  'AdAccount',
] as const;
export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];
