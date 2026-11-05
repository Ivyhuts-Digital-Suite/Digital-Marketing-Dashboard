import { describe, expect, it } from 'vitest';
import {
  GRANTABLE_PERMISSIONS,
  ORGANIZATION_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  canAssignRole,
  canManageMember,
  hasPermission,
  resolvePermissions,
} from '../src';

describe('role → permission matrix', () => {
  it('grants owners every grantable permission', () => {
    expect([...ROLE_PERMISSIONS.ORGANIZATION_OWNER].sort()).toEqual([...GRANTABLE_PERMISSIONS].sort());
  });

  it('never grants the reserved campaign-creation permission', () => {
    for (const role of ORGANIZATION_ROLES) {
      expect(ROLE_PERMISSIONS[role]).not.toContain(PERMISSIONS.CAMPAIGNS_CREATE);
    }
    expect(resolvePermissions(null, 'SUPER_ADMIN')).not.toContain(PERMISSIONS.CAMPAIGNS_CREATE);
  });

  it('gives every role organization read access and no duplicate entries', () => {
    for (const role of ORGANIZATION_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.ORGANIZATION_READ);
      expect(new Set(ROLE_PERMISSIONS[role]).size).toBe(ROLE_PERMISSIONS[role].length);
    }
  });

  it.each([
    ['ADMIN', PERMISSIONS.ORGANIZATION_ARCHIVE, false],
    ['ADMIN', PERMISSIONS.MEMBERS_INVITE, true],
    ['MARKETING_MANAGER', PERMISSIONS.CAMPAIGNS_BUDGET_UPDATE, true],
    ['MARKETING_MANAGER', PERMISSIONS.CRM_MANAGE, false],
    ['MARKETING_ANALYST', PERMISSIONS.CAMPAIGNS_UPDATE, false],
    ['MARKETING_ANALYST', PERMISSIONS.AI_ANALYZE, true],
    ['SALES_MANAGER', PERMISSIONS.CRM_MANAGE, true],
    ['SALES_MANAGER', PERMISSIONS.INTEGRATIONS_MANAGE, false],
    ['SALES_REPRESENTATIVE', PERMISSIONS.LEADS_MANAGE, true],
    ['SALES_REPRESENTATIVE', PERMISSIONS.AI_EXECUTE, false],
    ['VIEWER', PERMISSIONS.CAMPAIGNS_READ, true],
    ['VIEWER', PERMISSIONS.MEMBERS_INVITE, false],
    ['VIEWER', PERMISSIONS.AUDIT_READ, false],
  ] as const)('%s has %s: %s', (role, permission, expected) => {
    expect(hasPermission(ROLE_PERMISSIONS[role], permission)).toBe(expected);
  });

  it('resolves no permissions without a role', () => {
    expect(resolvePermissions(null)).toEqual([]);
  });
});

describe('role assignment rules', () => {
  it('owners may assign any role, including co-owners', () => {
    for (const role of ORGANIZATION_ROLES) expect(canAssignRole('ORGANIZATION_OWNER', role)).toBe(true);
  });

  it('others may only assign strictly lower roles', () => {
    expect(canAssignRole('ADMIN', 'ORGANIZATION_OWNER')).toBe(false);
    expect(canAssignRole('ADMIN', 'ADMIN')).toBe(false);
    expect(canAssignRole('ADMIN', 'SALES_MANAGER')).toBe(true);
    expect(canAssignRole('MARKETING_MANAGER', 'SALES_MANAGER')).toBe(false);
    expect(canAssignRole('MARKETING_MANAGER', 'MARKETING_ANALYST')).toBe(true);
  });

  it('members can only manage lower-ranked members', () => {
    expect(canManageMember('ADMIN', 'ORGANIZATION_OWNER')).toBe(false);
    expect(canManageMember('ADMIN', 'VIEWER')).toBe(true);
    expect(canManageMember('ORGANIZATION_OWNER', 'ORGANIZATION_OWNER')).toBe(true);
  });
});
