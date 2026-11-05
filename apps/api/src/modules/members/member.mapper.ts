import type { Types } from 'mongoose';
import type { InvitationDto, OrganizationMemberDto } from '@mp/types';
import type { Invitation } from './invitation.model';
import type { OrganizationMember } from './member.model';

interface UserRef {
  _id: Types.ObjectId;
  name: string;
  email: string;
}

export type MemberWithUser = Omit<OrganizationMember, 'userId'> & { userId: UserRef };
export type InvitationWithInviter = Omit<Invitation, 'invitedBy' | 'tokenHash'> & { invitedBy: UserRef | Types.ObjectId | null };

export function toMemberDto(member: MemberWithUser): OrganizationMemberDto {
  return {
    id: String(member._id),
    organizationId: String(member.organizationId),
    role: member.role,
    status: member.status,
    joinedAt: member.joinedAt.toISOString(),
    user: { id: String(member.userId._id), name: member.userId.name, email: member.userId.email },
  };
}

function isUserRef(value: InvitationWithInviter['invitedBy']): value is UserRef {
  return Boolean(value && typeof value === 'object' && 'name' in value);
}

export function toInvitationDto(invitation: InvitationWithInviter): InvitationDto {
  const expired = invitation.status === 'PENDING' && invitation.expiresAt <= new Date();
  return {
    id: String(invitation._id),
    organizationId: String(invitation.organizationId),
    email: invitation.email,
    role: invitation.role,
    status: expired ? 'EXPIRED' : invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    invitedBy: isUserRef(invitation.invitedBy)
      ? { id: String(invitation.invitedBy._id), name: invitation.invitedBy.name }
      : null,
    createdAt: invitation.createdAt.toISOString(),
  };
}
