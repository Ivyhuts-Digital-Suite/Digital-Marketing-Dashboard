import { model, Schema, type Types } from 'mongoose';
import { INVITATION_STATUSES, ORGANIZATION_ROLES, type InvitationStatus, type OrganizationRole } from '@mp/shared';
import { createSchema } from '../../lib/mongoose/base-schema';
import { tenantGuardPlugin } from '../../lib/mongoose/tenant-guard.plugin';

/**
 * Pending invitation to join an organization. Only the SHA-256 hash of the one-time
 * token is stored; the raw token exists only in the invitation link.
 */
export interface Invitation {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  email: string;
  role: OrganizationRole;
  tokenHash: string;
  status: InvitationStatus;
  expiresAt: Date;
  invitedBy: Types.ObjectId;
  acceptedAt: Date | null;
  acceptedBy: Types.ObjectId | null;
  revokedAt: Date | null;
  revokedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = createSchema<Invitation>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  role: { type: String, enum: ORGANIZATION_ROLES, required: true },
  tokenHash: { type: String, required: true, select: false },
  status: { type: String, enum: INVITATION_STATUSES, default: 'PENDING', required: true },
  expiresAt: { type: Date, required: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  acceptedAt: { type: Date, default: null },
  acceptedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});

invitationSchema.plugin(tenantGuardPlugin);
invitationSchema.index({ tokenHash: 1 }, { unique: true });
invitationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
// At most one pending invitation per email per organization.
invitationSchema.index(
  { organizationId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' }, name: 'unique_pending_invitation' },
);

export const InvitationModel = model<Invitation>('Invitation', invitationSchema);
