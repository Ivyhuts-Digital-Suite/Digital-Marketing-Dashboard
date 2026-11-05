import type { Request, RequestHandler } from 'express';
import { Types } from 'mongoose';
import {
  AUDIT_ACTIONS,
  ORGANIZATION_HEADER,
  resolvePermissions,
  type OrganizationRole,
  type Permission,
} from '@mp/shared';
import type { AppContext } from '../app-context';
import { Errors } from '../lib/errors';
import type { TenantScope } from '../lib/mongoose/tenant-repository';
import { OrganizationMemberModel, type OrganizationMember } from '../modules/members/member.model';
import { OrganizationModel, type Organization } from '../modules/organizations/organization.model';
import { requireAuth } from './authenticate';

export interface TenantContext extends TenantScope {
  organization: Organization;
  membership: OrganizationMember | null;
  /** Effective role. Platform super admins without a membership act as owners. */
  role: OrganizationRole;
  permissions: readonly Permission[];
  /** True when a platform SUPER_ADMIN accesses an organization they are not a member of. */
  isSupportAccess: boolean;
}

type OrganizationSource = 'header' | 'param';

/**
 * Resolves the active organization and verifies the authenticated user's ACTIVE
 * membership. The organization ID from the client is only a *selector*: access is granted
 * solely from the server-side membership record. Unknown, archived and inaccessible
 * organizations all produce the same 403, so organization IDs cannot be probed.
 */
export function requireOrganization(ctx: AppContext, source: OrganizationSource = 'header'): RequestHandler {
  return async (req, _res, next) => {
    const auth = requireAuth(req);
    const raw = source === 'param' ? req.params.organizationId : req.get(ORGANIZATION_HEADER);
    if (!raw) throw Errors.organizationRequired();
    if (typeof raw !== 'string' || !/^[a-f\d]{24}$/i.test(raw)) throw Errors.organizationAccessDenied();

    const organizationId = new Types.ObjectId(raw);
    const [organization, membership] = await Promise.all([
      OrganizationModel.findOne({ _id: organizationId, status: 'ACTIVE' }).lean(),
      OrganizationMemberModel.findOne({ organizationId, userId: auth.userId, status: 'ACTIVE' }).lean(),
    ]);
    if (!organization) throw Errors.organizationAccessDenied();

    const isSuperAdmin = auth.user.platformRole === 'SUPER_ADMIN';
    if (!membership && !isSuperAdmin) throw Errors.organizationAccessDenied();

    const role: OrganizationRole = membership?.role ?? 'ORGANIZATION_OWNER';
    req.tenant = {
      organizationId,
      organization,
      membership,
      role,
      permissions: resolvePermissions(membership?.role ?? null, auth.user.platformRole),
      isSupportAccess: !membership && isSuperAdmin,
    };

    if (req.tenant.isSupportAccess) {
      await ctx.audit.recordFromRequest(req, {
        action: AUDIT_ACTIONS.ORGANIZATION_SUPPORT_ACCESS,
        resourceType: 'Organization',
        resourceId: organizationId,
        metadata: { method: req.method, path: req.originalUrl.split('?')[0] },
      });
    }
    next();
  };
}

/** Narrowing helper for handlers mounted behind `requireOrganization`. */
export function requireTenant(req: Request): TenantContext {
  if (!req.tenant) throw Errors.organizationRequired();
  return req.tenant;
}
