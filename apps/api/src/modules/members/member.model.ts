import { model, Schema, type Types } from 'mongoose';
import { MEMBERSHIP_STATUSES, ORGANIZATION_ROLES, type MembershipStatus, type OrganizationRole } from '@mp/shared';
import { createSchema } from '../../lib/mongoose/base-schema';
import { tenantGuardPlugin } from '../../lib/mongoose/tenant-guard.plugin';

/**
 * Links a user to an organization with a role. One document per (organization, user);
 * removal sets status REMOVED so history is preserved and re-invitation reactivates it.
 */
export interface OrganizationMember {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: OrganizationRole;
  status: MembershipStatus;
  invitedBy: Types.ObjectId | null;
  joinedAt: Date;
  removedAt: Date | null;
  removedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = createSchema<OrganizationMember>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ORGANIZATION_ROLES, required: true },
  status: { type: String, enum: MEMBERSHIP_STATUSES, default: 'ACTIVE', required: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  joinedAt: { type: Date, required: true, default: () => new Date() },
  removedAt: { type: Date, default: null },
  removedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});

memberSchema.plugin(tenantGuardPlugin);
memberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
memberSchema.index({ organizationId: 1, status: 1, role: 1 });
memberSchema.index({ userId: 1, status: 1 });

export const OrganizationMemberModel = model<OrganizationMember>('OrganizationMember', memberSchema);
