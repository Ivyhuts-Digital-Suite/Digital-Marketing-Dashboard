import type { Request } from 'express';
import type { Types } from 'mongoose';
import { AUDIT_ACTIONS, permissionsForRole } from '@mp/shared';
import type { OrganizationWithMembershipDto } from '@mp/types';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '@mp/validators';
import type { AppContext } from '../../app-context';
import { randomToken } from '../../lib/crypto';
import { Errors } from '../../lib/errors';
import type { AuthContext } from '../../middleware/authenticate';
import type { TenantContext } from '../../middleware/organization-context';
import { OrganizationMemberModel } from '../members/member.model';
import { toOrganizationWithMembershipDto } from './organization.mapper';
import { OrganizationModel, type Organization } from './organization.model';

function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug.length >= 3 ? slug : `org-${slug || randomToken(3).toLowerCase()}`;
}

export class OrganizationService {
  constructor(private readonly ctx: AppContext) {}

  /** Creates an organization and makes the creator its ORGANIZATION_OWNER. */
  async create(req: Request, actor: AuthContext, input: CreateOrganizationInput): Promise<OrganizationWithMembershipDto> {
    const slug = await this.resolveSlug(input.slug, input.name);
    const organization = await OrganizationModel.create({
      name: input.name,
      slug,
      timezone: input.timezone,
      currency: input.currency,
      createdBy: actor.userId,
    });

    let membership;
    try {
      membership = await OrganizationMemberModel.create({
        organizationId: organization._id,
        userId: actor.userId,
        role: 'ORGANIZATION_OWNER',
      });
    } catch (error) {
      // Standalone MongoDB has no multi-document transactions; compensate instead.
      await OrganizationModel.deleteOne({ _id: organization._id });
      throw error;
    }

    await this.ctx.audit.recordFromRequest(req, {
      action: AUDIT_ACTIONS.ORGANIZATION_CREATE,
      organizationId: organization._id,
      resourceType: 'Organization',
      resourceId: organization._id,
      metadata: { name: organization.name, slug },
    });

    return toOrganizationWithMembershipDto(organization.toObject(), {
      id: String(membership._id),
      role: membership.role,
      permissions: permissionsForRole(membership.role),
    });
  }

  /** Active organizations the user is an active member of. */
  async listForUser(userId: Types.ObjectId): Promise<OrganizationWithMembershipDto[]> {
    // Deliberately cross-tenant: the user's own memberships across all organizations.
    const memberships = await OrganizationMemberModel.find({ userId, status: 'ACTIVE' })
      .setOptions({ skipTenantGuard: true })
      .lean();
    if (memberships.length === 0) return [];

    const organizations = await OrganizationModel.find({
      _id: { $in: memberships.map((m) => m.organizationId) },
      status: 'ACTIVE',
    })
      .sort({ name: 1 })
      .lean();

    const byOrg = new Map(memberships.map((m) => [String(m.organizationId), m]));
    return organizations.map((org) => {
      const membership = byOrg.get(String(org._id))!;
      return toOrganizationWithMembershipDto(org, {
        id: String(membership._id),
        role: membership.role,
        permissions: permissionsForRole(membership.role),
      });
    });
  }

  describe(tenant: TenantContext): OrganizationWithMembershipDto {
    return toOrganizationWithMembershipDto(tenant.organization, {
      id: tenant.membership ? String(tenant.membership._id) : 'support-access',
      role: tenant.role,
      permissions: tenant.permissions,
    });
  }

  async update(req: Request, tenant: TenantContext, input: UpdateOrganizationInput): Promise<OrganizationWithMembershipDto> {
    const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    const updated = await OrganizationModel.findOneAndUpdate(
      { _id: tenant.organizationId, status: 'ACTIVE' },
      { $set: changes },
      { returnDocument: 'after', runValidators: true },
    ).lean<Organization>();
    if (!updated) throw Errors.notFound('Organization');

    await this.ctx.audit.recordFromRequest(req, {
      action: AUDIT_ACTIONS.ORGANIZATION_UPDATE,
      resourceType: 'Organization',
      resourceId: tenant.organizationId,
      metadata: { changes },
    });
    return this.describe({ ...tenant, organization: updated });
  }

  /** Archives (soft-deletes) the organization. Data and audit history are retained. */
  async archive(req: Request, tenant: TenantContext, actor: AuthContext): Promise<void> {
    const result = await OrganizationModel.updateOne(
      { _id: tenant.organizationId, status: 'ACTIVE' },
      { $set: { status: 'ARCHIVED', archivedAt: new Date(), archivedBy: actor.userId } },
    );
    if (result.modifiedCount === 0) throw Errors.notFound('Organization');

    await this.ctx.audit.recordFromRequest(req, {
      action: AUDIT_ACTIONS.ORGANIZATION_ARCHIVE,
      resourceType: 'Organization',
      resourceId: tenant.organizationId,
    });
  }

  private async resolveSlug(requested: string | undefined, name: string): Promise<string> {
    if (requested) {
      if (await OrganizationModel.exists({ slug: requested })) throw Errors.conflict('This slug is already in use');
      return requested;
    }
    const base = slugify(name);
    if (!(await OrganizationModel.exists({ slug: base }))) return base;
    return `${base}-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 48);
  }
}
