import { Types } from 'mongoose';
import { AUDIT_ACTIONS } from '@mp/shared';
import type { LoginInput, RegisterInput } from '@mp/validators';
import type { AppContext } from '../../app-context';
import { randomToken, sha256 } from '../../lib/crypto';
import { Errors } from '../../lib/errors';
import { UserModel, type User } from '../users/user.model';
import type { IssuedTokens } from './cookies';
import { hashPassword, needsRehash, verifyAgainstDummy, verifyPassword } from './password';
import { SessionModel, type SessionRevokeReason } from './session.model';

export const LOCKOUT_POLICY = {
  MAX_FAILED_ATTEMPTS: 5,
  LOCK_DURATION_MS: 15 * 60 * 1000,
} as const;

/** Window in which the token just replaced by a concurrent refresh is tolerated (multi-tab). */
const REFRESH_RACE_GRACE_MS = 30_000;

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;
}

export type SafeUser = Omit<User, 'passwordHash'>;

export class AuthService {
  constructor(private readonly ctx: AppContext) {}

  async register(input: RegisterInput, meta: RequestMeta): Promise<{ user: SafeUser; tokens: IssuedTokens }> {
    const existing = await UserModel.exists({ email: input.email });
    if (existing) throw Errors.conflict('An account with this email already exists');

    const passwordHash = await hashPassword(input.password);
    let created;
    try {
      created = await UserModel.create({
        email: input.email,
        name: input.name,
        passwordHash,
        lastLoginAt: new Date(),
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw Errors.conflict('An account with this email already exists');
      }
      throw error;
    }

    const tokens = await this.createSession(created._id, meta);
    await this.ctx.audit.record({
      action: AUDIT_ACTIONS.AUTH_REGISTER,
      resourceType: 'User',
      resourceId: created._id,
      actorUserId: created._id,
      ...meta,
    });
    return { user: stripPassword(created.toObject()), tokens };
  }

  async login(input: LoginInput, meta: RequestMeta): Promise<{ user: SafeUser; tokens: IssuedTokens }> {
    const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');

    if (!user) {
      await verifyAgainstDummy(input.password);
      await this.ctx.audit.record({
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        resourceType: 'User',
        metadata: { reason: 'unknown_email', email: input.email },
        ...meta,
      });
      throw Errors.invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordFailure(user._id, 'locked', meta);
      throw Errors.accountLocked();
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      await this.registerFailedAttempt(user._id);
      await this.recordFailure(user._id, 'invalid_password', meta);
      throw Errors.invalidCredentials();
    }

    // Status is checked only after the password, so it is never revealed to someone guessing.
    if (user.status !== 'ACTIVE') {
      await this.recordFailure(user._id, 'account_inactive', meta);
      throw Errors.accountDisabled();
    }

    const update: Record<string, unknown> = { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() };
    if (needsRehash(user.passwordHash)) update.passwordHash = await hashPassword(input.password);
    await UserModel.updateOne({ _id: user._id }, { $set: update });

    const tokens = await this.createSession(user._id, meta);
    await this.ctx.audit.record({
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      resourceType: 'User',
      resourceId: user._id,
      actorUserId: user._id,
      ...meta,
    });

    const plain = user.toObject();
    return { user: stripPassword({ ...plain, lastLoginAt: update.lastLoginAt as Date }), tokens };
  }

  /**
   * Rotates the refresh token. Returns `null` when a concurrent request already rotated
   * this token moments ago (the browser holds the newer cookies, so nothing is issued).
   * Presenting any older token is treated as theft: the whole session is revoked.
   */
  async refresh(refreshToken: string, meta: RequestMeta): Promise<IssuedTokens | null> {
    const claims = await this.ctx.tokens.verifyRefreshToken(refreshToken);
    if (!Types.ObjectId.isValid(claims.sessionId)) throw Errors.unauthenticated('Invalid refresh token');

    const session = await SessionModel.findById(claims.sessionId);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      String(session.userId) !== claims.userId
    ) {
      throw Errors.unauthenticated('Session is no longer valid');
    }

    const presentedHash = sha256(claims.tokenId);
    const now = new Date();

    if (presentedHash === session.refreshTokenHash) {
      const user = await UserModel.findById(session.userId).lean();
      if (!user || user.status !== 'ACTIVE') {
        await this.revokeSession(session._id, 'account_disabled');
        throw Errors.unauthenticated('Session is no longer valid');
      }

      const nextTokenId = randomToken(24);
      const rotated = await SessionModel.findOneAndUpdate(
        { _id: session._id, refreshTokenHash: presentedHash, revokedAt: null },
        {
          $set: {
            refreshTokenHash: sha256(nextTokenId),
            previousRefreshTokenHash: presentedHash,
            rotatedAt: now,
            lastUsedAt: now,
            ipAddress: meta.ipAddress,
          },
          $inc: { rotationCount: 1 },
        },
        { returnDocument: 'after' },
      );
      // Lost a race with a concurrent refresh of the same token.
      if (!rotated) return null;

      return this.issueTokens(String(session.userId), String(session._id), nextTokenId, session.expiresAt);
    }

    const withinGrace =
      presentedHash === session.previousRefreshTokenHash &&
      session.rotatedAt !== null &&
      now.getTime() - session.rotatedAt.getTime() < REFRESH_RACE_GRACE_MS;
    if (withinGrace) return null;

    await this.revokeSession(session._id, 'reuse_detected');
    await this.ctx.audit.record({
      action: AUDIT_ACTIONS.AUTH_REFRESH_REUSE_DETECTED,
      resourceType: 'Session',
      resourceId: session._id,
      actorUserId: session.userId,
      ...meta,
    });
    throw Errors.unauthenticated('Session is no longer valid');
  }

  /** Revokes the session identified by either token. Never fails: logout must always clear cookies. */
  async logout(tokens: { accessToken?: string | undefined; refreshToken?: string | undefined }, meta: RequestMeta) {
    const sessionRef = await this.identifySession(tokens);
    if (!sessionRef) return;
    const revoked = await this.revokeSession(new Types.ObjectId(sessionRef.sessionId), 'logout');
    if (revoked) {
      await this.ctx.audit.record({
        action: AUDIT_ACTIONS.AUTH_LOGOUT,
        resourceType: 'Session',
        resourceId: sessionRef.sessionId,
        actorUserId: new Types.ObjectId(sessionRef.userId),
        ...meta,
      });
    }
  }

  async logoutAll(userId: Types.ObjectId, meta: RequestMeta): Promise<number> {
    const count = await this.revokeAllSessions(userId, 'logout_all');
    await this.ctx.audit.record({
      action: AUDIT_ACTIONS.AUTH_LOGOUT_ALL,
      resourceType: 'User',
      resourceId: userId,
      actorUserId: userId,
      metadata: { revokedSessions: count },
      ...meta,
    });
    return count;
  }

  async revokeAllSessions(
    userId: Types.ObjectId,
    reason: SessionRevokeReason,
    exceptSessionId?: Types.ObjectId,
  ): Promise<number> {
    const result = await SessionModel.updateMany(
      { userId, revokedAt: null, ...(exceptSessionId && { _id: { $ne: exceptSessionId } }) },
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    );
    return result.modifiedCount;
  }

  private async createSession(userId: Types.ObjectId, meta: RequestMeta): Promise<IssuedTokens> {
    const tokenId = randomToken(24);
    const expiresAt = new Date(Date.now() + this.ctx.tokens.refreshTtlSeconds * 1000);
    const session = await SessionModel.create({
      userId,
      refreshTokenHash: sha256(tokenId),
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
      ipAddress: meta.ipAddress,
      expiresAt,
    });
    return this.issueTokens(String(userId), String(session._id), tokenId, expiresAt);
  }

  private async issueTokens(userId: string, sessionId: string, tokenId: string, expiresAt: Date): Promise<IssuedTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.ctx.tokens.signAccessToken({ userId, sessionId }),
      this.ctx.tokens.signRefreshToken({ userId, sessionId, tokenId }, expiresAt),
    ]);
    return { accessToken, refreshToken, refreshExpiresAt: expiresAt };
  }

  private async revokeSession(sessionId: Types.ObjectId, reason: SessionRevokeReason): Promise<boolean> {
    const result = await SessionModel.updateOne(
      { _id: sessionId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    );
    return result.modifiedCount > 0;
  }

  private async identifySession(tokens: { accessToken?: string | undefined; refreshToken?: string | undefined }) {
    const attempts: Array<() => Promise<{ userId: string; sessionId: string }>> = [];
    if (tokens.refreshToken) attempts.push(() => this.ctx.tokens.verifyRefreshToken(tokens.refreshToken!));
    if (tokens.accessToken) attempts.push(() => this.ctx.tokens.verifyAccessToken(tokens.accessToken!));
    for (const attempt of attempts) {
      try {
        const claims = await attempt();
        if (Types.ObjectId.isValid(claims.sessionId)) return claims;
      } catch {
        // Invalid or expired token: try the next one.
      }
    }
    return null;
  }

  private async registerFailedAttempt(userId: Types.ObjectId): Promise<void> {
    const updated = await UserModel.findOneAndUpdate(
      { _id: userId },
      { $inc: { failedLoginAttempts: 1 } },
      { returnDocument: 'after', projection: { failedLoginAttempts: 1 } },
    ).lean();
    if (updated && updated.failedLoginAttempts >= LOCKOUT_POLICY.MAX_FAILED_ATTEMPTS) {
      await UserModel.updateOne(
        { _id: userId },
        { $set: { lockedUntil: new Date(Date.now() + LOCKOUT_POLICY.LOCK_DURATION_MS), failedLoginAttempts: 0 } },
      );
    }
  }

  private recordFailure(userId: Types.ObjectId, reason: string, meta: RequestMeta) {
    return this.ctx.audit.record({
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      resourceType: 'User',
      resourceId: userId,
      actorUserId: userId,
      metadata: { reason },
      ...meta,
    });
  }
}

function stripPassword<T extends { passwordHash?: string }>(user: T): Omit<T, 'passwordHash'> {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}
