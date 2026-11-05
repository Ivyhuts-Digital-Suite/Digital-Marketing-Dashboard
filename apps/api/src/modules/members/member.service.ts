import type { Request } from 'express';
import {
  AUDIT_ACTIONS,
  INVITATION_TTL_DAYS,
  ROLE_LABELS,
  canAssignRole,
  canManageMember,
  permissionsForRole,
  type OrganizationRole,
} from '@mp/shared';
import type { CreatedInvitationDto, InvitationDto, OrganizationMemberDto, OrganizationWithMembershipDto } from '@mp/types';
import type { CreateInvitationInput } from '@mp/validators';
import type { AppContext } from '../../app-context';
import { randomToken, sha256 } from '../../lib/crypto';
import { Errors } from '../../lib/errors';
import type { AuthContext } from '../../middleware/authenticate';
import type { TenantContext } from '../../middleware/organization-context';
import { toOrganizationWithMembershipDto } from '../organizations/organization.mapper';
import { OrganizationModel } from '../organizations/organization.model';
import { UserModel } from '../users/user.model';
import { InvitationModel } from './invitation.model';
import { OrganizationMemberModel } from './member.model';
import { toInvitationDto, toMemberDto, type InvitationWithInviter, type MemberWithUser } from './member.mapper';
import { InvitationRepository, MemberRepository } from './member.repository';

const LAST_OWNER_MESSAGE = 'An organization must keep at least one owner';

export class MemberService {
  private readonly members = new MemberRepository();
  private readonly invitations = new InvitationRepository();

  constructor(private readonly ctx: AppContext) {}

  async list(tenant: TenantContext): Promise<OrganizationMemberDto[]> {
    const docs = await this.members
      .find(tenant, { status: 'ACTIVE' })
      .populate('userId', 'name email')
      .sort({ joinedAt: 1 })
      .lean<MemberWithUser[]>();
    return docs.filter((doc) => doc.userId).map(toMemberDto);
  }

  async updateRole(
    req: Request,
    tenant: TenantContext,
    actor: AuthContext,
    memberId: string,
    role: OrganizationRole,
  ): Promise<OrganizationMemberDto> {
    const member = await this.members.findOne(tenant, { _id: memberId, status: 'ACTIVE' }).lean();
    if (!member) throw Errors.notFound('Member');
    if (member.userId.equals(actor.userId)) throw Errors.forbidden('You cannot change your own role');
    if (!canManageMember(tenant.role, member.role)) throw Errors.forbidden('You cannot manage a member with this role');
    if (!canAssignRole(tenant.role, role)) throw Errors.forbidden('You cannot assign this role');

    if (member.role === role) return this.getMember(tenant, memberId);
    if (member.role === 'ORGANIZATION_OWNER' && (await this.members.countActiveOwners(tenant)) <= 1) {
      throw Errors.conflict(LAST_OWNER_MESSAGE);
    }

    await this.members.updateById(tenant, memberId, { $set: { role } });
    await this.ctx.audit.recordFromRequest(req, {
      action: AUDIT_ACTIONS.MEMBER_ROLE_UPDATE,
      resourceType: 'OrganizationMember',
      resourceId: memberId,
      metadata: { userId: String(member.userId), previousRole: member.role, newRole: role },
    });
    return this.getMember(tenant, memberId);
  }

  async remove(req: Request, tenant: TenantContext, actor: AuthContext, memberId: string): Promise<void> {
    const member = await this.members.findOne(tenant, { _id: memberId, status: 'ACTIVE' }).lean();
    if (!member) throw Errors.notFound('Member');
    if (member.userId.equals(actor.userId)) throw Errors.forbidden('You cannot remove yourself');
    if (!canManageMember(tenant.role, member.role)) throw Errors.forbidden('You cannot manage a member with this role');
    if (member.role === 'ORGANIZATION_OWNER' && (await this.members.countActiveOwners(tenant)) <= 1) {
      throw Errors.conflict(LAST_OWNER_MESSAGE);
    }

    await this.members.updateById(tenant, memberId, {
      $set: { status: 'REMOVED', removedAt: new Date(), removedBy: actor.userId },
    });
    await this.ctx.audit.recordFromRequest(req, {
      action: AUDIT_ACTIONS.MEMBER_REMOVE,
      resourceType: 'OrganizationMember',
      resourceId: memberId,
      metadata: { userId: String(member.userId), role: member.role },
    });
  }

  async listInvitations(tenant: TenantContext): Promise<InvitationDto[]> {
    await this.invitations.expireStale(tenant);
    const docs = await this.invitations
      .find(tenant, { status: 'PENDING' })
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean<InvitationWithInviter[]>();
    return docs.map(toInvitationDto);
  }

  async createInvitation(
    req: Request,
    tenant: TenantContext,
    actor: AuthContext,
    input: CreateInvitationInput,
  ): Promise<CreatedInvitationDto> {
    if (!canAssignRole(tenant.role, input.role)) throw Errors.forbidden('You cannot invite members with this role');

    const existingUser = await UserModel.findOne({ email: input.email }, { _id: 1 }).lean();
    if (existingUser && (await this.members.findOne(tenant, { userId: existingUser._id, status: 'ACTIVE' }).lean())) {
      throw Errors.conflict('This person is already a member of the organization');
    }

    await this.invitations.expireStale(tenant, input.email);
    if (await this.invitations.findOne(tenant, { email: input.email, status: 'PENDING' }).lean()) {
      throw Errors.conflict('This email already has a pending invitation');
    }

    const token = randomToken(32);
    let invitation;
    try {
      invitation = await this.invitations.create(tenant, {
        email: input.email,
        role: input.role,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 3600 * 1000),
        invitedBy: actor.userId,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw Errors.conflict('This email already has a pending invitation');
      }
      throw error;
    }

    const acceptUrl = `${this.ctx.config.web.url.replace(/\/$/, '')}/invitations/accept?token=${token}`;
    const organizationName = tenant.organization.name;
    const delivery = await this.ctx.mailer.send({
      to: input.email,
      subject: `You're invited to join ${organizationName}`,
      text: [
        `${actor.user.name} invited you to join ${organizationName} as ${ROLE_LABELS[input.role]}.`,
        '',
        `Accept the invitation: ${acceptUrl}`,
        '',
        `This link expires in ${INVITATION_TTL_DAYS} days.`,
      ].join('\n'),
    });

    await this.ctx.audit.recordFromRequest(req, {
      action: AUDIT_ACTIONS.INVITATION_CREATE,
      resourceType: 'Invitation',
      resourceId: invitation._id,
      metadata: { email: input.email, role: input.role, delivery },
    });

    const { tokenHash: _hidden, ...plain } = invitation.toObject();
    return {
      invitation: toInvitationDto({ ...plain, invitedBy: { _id: actor.userId, name: actor.user.name, email: actor.user.email } }),
      delivery,
      // Without SMTP the link is returned once to the (authorized) inviter to share manually.
      ...(delivery === 'manual' && { acceptUrl }),
    };
  }

  async revokeInvitation(req: Request, tenant: TenantContext, actor: AuthContext, invitationId: string): Promise<void> {
    const updated = await this.invitations
      .findOne(tenant, { _id: invitationId, status: 'PENDING' })
      .lean();
    if (!updated) throw Errors.notFound('Invitation');

    await this.invitations.updateById(tenant, invitationId, {
      $set: { status: 'REVOKED', revokedAt: new Date(), revokedBy: actor.userId },
    });
    await this.ctx.audit.recordFromRequest(req, {
      action: AUDIT_ACTIONS.INVITATION_REVOKE,
      resourceType: 'Invitation',
      resourceId: invitationId,
      metadata: { email: updated.email },
    });
  }

  /**
   * Accepts an invitation for the signed-in user. The token (not a client-supplied
   * organization ID) determines the organization, and the invitation email must match.
   */
  async acceptInvitation(req: Request, actor: AuthContext, token: string): Promise<OrganizationWithMembershipDto> {
    // Cross-tenant lookup by an unguessable one-time token.
    const invitation = await InvitationModel.findOne({ tokenHash: sha256(token) })
      .setOptions({ skipTenantGuard: true })
      .lean();
    if (!invitation || invitation.status !== 'PENDING') throw Errors.notFound('Invitation');

    const scope = { organizationId: invitation.organizationId };
    if (invitation.expiresAt <= new Date()) {
      await this.invitations.updateById(scope, invitation._id, { $set: { status: 'EXPIRED' } });
      throw Errors.badRequest('This invitation has expired');
    }
    if (invitation.email !== actor.user.email) {
      throw Errors.forbidden('This invitation was sent to a different email address');
    }

    const organization = await OrganizationModel.findOne({ _id: invitation.organizationId, status: 'ACTIVE' }).lean();
    if (!organization) throw Errors.notFound('Invitation');

    const existing = await this.members.findOne(scope, { userId: actor.userId }).lean();
    if (existing?.status === 'ACTIVE') throw Errors.conflict('You are already a member of this organization');

    // Claim the invitation first so it can only ever be accepted once.
    const claimed = await InvitationModel.findOneAndUpdate(
      { _id: invitation._id, organizationId: invitation.organizationId, status: 'PENDING' },
      { $set: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedBy: actor.userId } },
    );
    if (!claimed) throw Errors.notFound('Invitation');

    const membership = await OrganizationMemberModel.findOneAndUpdate(
      { organizationId: invitation.organizationId, userId: actor.userId },
      {
        $set: {
          role: invitation.role,
          status: 'ACTIVE',
          invitedBy: invitation.invitedBy,
          joinedAt: new Date(),
          removedAt: null,
          removedBy: null,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    await this.ctx.audit.recordFromRequest(req, {
      action: AUDIT_ACTIONS.INVITATION_ACCEPT,
      organizationId: invitation.organizationId,
      resourceType: 'Invitation',
      resourceId: invitation._id,
      metadata: { role: invitation.role, membershipId: String(membership!._id) },
    });

    return toOrganizationWithMembershipDto(organization, {
      id: String(membership!._id),
      role: membership!.role,
      permissions: permissionsForRole(membership!.role),
    });
  }

  private async getMember(tenant: TenantContext, memberId: string): Promise<OrganizationMemberDto> {
    const doc = await this.members.findById(tenant, memberId).populate('userId', 'name email').lean<MemberWithUser>();
    if (!doc) throw Errors.notFound('Member');
    return toMemberDto(doc);
  }
}
