import { model, Schema, type Types } from 'mongoose';
import { ORGANIZATION_STATUSES, type OrganizationStatus } from '@mp/shared';
import { createSchema } from '../../lib/mongoose/base-schema';

/**
 * The tenant root. Organizations are archived, never hard-deleted through the API, so
 * tenant-owned data and audit history remain intact and recoverable.
 */
export interface Organization {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  status: OrganizationStatus;
  timezone: string;
  currency: string;
  createdBy: Types.ObjectId;
  archivedAt: Date | null;
  archivedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = createSchema<Organization>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 64 },
  status: { type: String, enum: ORGANIZATION_STATUSES, default: 'ACTIVE', required: true },
  timezone: { type: String, required: true, default: 'UTC' },
  currency: { type: String, required: true, default: 'USD', uppercase: true, minlength: 3, maxlength: 3 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});

organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ status: 1, createdAt: -1 });

export const OrganizationModel = model<Organization>('Organization', organizationSchema);
