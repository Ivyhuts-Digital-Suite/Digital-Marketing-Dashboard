import { model, Schema, type Types } from 'mongoose';
import { createSchema } from '../../lib/mongoose/base-schema';

/**
 * Server-side record of a signed-in device. Each login creates one session; the refresh
 * token rotates within it. Storing only SHA-256 hashes of refresh-token IDs enables
 * rotation, reuse detection and immediate revocation without keeping usable tokens.
 */
export type SessionRevokeReason = 'logout' | 'logout_all' | 'reuse_detected' | 'password_changed' | 'account_disabled';

export interface Session {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  refreshTokenHash: string;
  /** Hash of the immediately preceding token, to tolerate concurrent refreshes from multiple tabs. */
  previousRefreshTokenHash: string | null;
  rotatedAt: Date | null;
  rotationCount: number;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: SessionRevokeReason | null;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = createSchema<Session>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  refreshTokenHash: { type: String, required: true },
  previousRefreshTokenHash: { type: String, default: null },
  rotatedAt: { type: Date, default: null },
  rotationCount: { type: Number, default: 0 },
  userAgent: { type: String, default: null, maxlength: 512 },
  ipAddress: { type: String, default: null, maxlength: 64 },
  lastUsedAt: { type: Date, required: true, default: () => new Date() },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  revokedReason: { type: String, default: null },
});

sessionSchema.index({ userId: 1, revokedAt: 1 });
// Expired sessions are removed automatically by MongoDB's TTL monitor.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<Session>('Session', sessionSchema);
