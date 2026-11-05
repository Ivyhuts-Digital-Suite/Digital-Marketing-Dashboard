import { PERMISSIONS as P, GRANTABLE_PERMISSIONS, type Permission } from './permissions';
import { ROLE_RANK, type OrganizationRole, type PlatformRole } from './roles';

const BASE_MEMBER: Permission[] = [P.ORGANIZATION_READ, P.MEMBERS_READ];

export const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  ORGANIZATION_OWNER: GRANTABLE_PERMISSIONS,
  ADMIN: GRANTABLE_PERMISSIONS.filter((p) => p !== P.ORGANIZATION_ARCHIVE),
  MARKETING_MANAGER: [
    ...BASE_MEMBER,
    P.INTEGRATIONS_READ,
    P.INTEGRATIONS_MANAGE,
    P.CAMPAIGNS_READ,
    P.CAMPAIGNS_UPDATE,
    P.CAMPAIGNS_BUDGET_UPDATE,
    P.CAMPAIGNS_PAUSE_RESUME,
    P.LEADS_READ,
    P.AI_ANALYZE,
    P.AI_RECOMMENDATIONS_READ,
    P.AI_EXECUTE,
    P.REPORTS_READ,
    P.REPORTS_MANAGE,
  ],
  MARKETING_ANALYST: [
    ...BASE_MEMBER,
    P.INTEGRATIONS_READ,
    P.CAMPAIGNS_READ,
    P.LEADS_READ,
    P.AI_ANALYZE,
    P.AI_RECOMMENDATIONS_READ,
    P.REPORTS_READ,
    P.REPORTS_MANAGE,
  ],
  SALES_MANAGER: [
    ...BASE_MEMBER,
    P.CAMPAIGNS_READ,
    P.LEADS_READ,
    P.LEADS_MANAGE,
    P.CRM_READ,
    P.CRM_MANAGE,
    P.AI_ANALYZE,
    P.AI_RECOMMENDATIONS_READ,
    P.REPORTS_READ,
    P.REPORTS_MANAGE,
  ],
  SALES_REPRESENTATIVE: [...BASE_MEMBER, P.LEADS_READ, P.LEADS_MANAGE, P.CRM_READ, P.CRM_MANAGE, P.REPORTS_READ],
  VIEWER: [...BASE_MEMBER, P.INTEGRATIONS_READ, P.CAMPAIGNS_READ, P.LEADS_READ, P.CRM_READ, P.REPORTS_READ],
};

export function permissionsForRole(role: OrganizationRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Effective permissions inside an organization. A platform SUPER_ADMIN receives every
 * grantable permission (their cross-tenant access is audited by the API).
 */
export function resolvePermissions(
  role: OrganizationRole | null,
  platformRole: PlatformRole = 'USER',
): readonly Permission[] {
  if (platformRole === 'SUPER_ADMIN') return GRANTABLE_PERMISSIONS;
  return role ? ROLE_PERMISSIONS[role] : [];
}

export function hasPermission(granted: readonly Permission[], required: Permission): boolean {
  return granted.includes(required);
}

export function hasAllPermissions(granted: readonly Permission[], required: readonly Permission[]): boolean {
  return required.every((permission) => granted.includes(permission));
}

/**
 * Role-assignment rule: an actor may assign a role only if it ranks strictly below
 * their own, except owners, who may appoint co-owners.
 */
export function canAssignRole(actorRole: OrganizationRole, targetRole: OrganizationRole): boolean {
  if (actorRole === 'ORGANIZATION_OWNER') return true;
  return ROLE_RANK[targetRole] < ROLE_RANK[actorRole];
}

/** An actor may modify or remove a member only if the member ranks strictly below them (owners excepted). */
export function canManageMember(actorRole: OrganizationRole, memberRole: OrganizationRole): boolean {
  if (actorRole === 'ORGANIZATION_OWNER') return true;
  return ROLE_RANK[memberRole] < ROLE_RANK[actorRole];
}
