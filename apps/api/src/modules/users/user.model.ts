import { model, type HydratedDocument, type Types } from 'mongoose';
import { PLATFORM_ROLES, USER_STATUSES, type PlatformRole, type UserStatus } from '@mp/shared';
import { createSchema } from '../../lib/mongoose/base-schema';

/** Global (non-tenant) identity. Organization access is granted through OrganizationMember. */
export interface User {
  _id: Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  status: UserStatus;
  platformRole: PlatformRole;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

const userSchema = createSchema<User>({
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  // Excluded from queries by default; auth code selects it explicitly.
  passwordHash: { type: String, required: true, select: false },
  status: { type: String, enum: USER_STATUSES, default: 'ACTIVE', required: true },
  platformRole: { type: String, enum: PLATFORM_ROLES, default: 'USER', required: true },
  emailVerifiedAt: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
  failedLoginAttempts: { type: Number, default: 0, min: 0 },
  lockedUntil: { type: Date, default: null },
  passwordChangedAt: { type: Date, default: null },
});

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1, createdAt: -1 });

export const UserModel = model<User>('User', userSchema);
