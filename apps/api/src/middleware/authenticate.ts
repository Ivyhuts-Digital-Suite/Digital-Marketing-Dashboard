import type { Request, RequestHandler } from 'express';
import { Types } from 'mongoose';
import type { AppContext } from '../app-context';
import { Errors } from '../lib/errors';
import { readAccessToken } from '../modules/auth/cookies';
import { SessionModel } from '../modules/auth/session.model';
import { UserModel, type User } from '../modules/users/user.model';

export interface AuthContext {
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  user: Omit<User, 'passwordHash'>;
}

/**
 * Verifies the access token and that its server-side session is still live, so logout,
 * "sign out everywhere", password changes and account suspension take effect immediately.
 */
export function authenticate(ctx: AppContext): RequestHandler {
  return async (req, _res, next) => {
    const token = readAccessToken(req);
    if (!token) throw Errors.unauthenticated();

    const claims = await ctx.tokens.verifyAccessToken(token);
    if (!Types.ObjectId.isValid(claims.sessionId) || !Types.ObjectId.isValid(claims.userId)) {
      throw Errors.unauthenticated('Invalid access token');
    }

    const [session, user] = await Promise.all([
      SessionModel.findById(claims.sessionId, { userId: 1, revokedAt: 1, expiresAt: 1 }).lean(),
      UserModel.findById(claims.userId).lean<Omit<User, 'passwordHash'>>(),
    ]);

    if (!session || session.revokedAt || session.expiresAt <= new Date() || String(session.userId) !== claims.userId) {
      throw Errors.unauthenticated('Session is no longer valid');
    }
    if (!user || user.status !== 'ACTIVE') throw Errors.unauthenticated('Session is no longer valid');

    req.auth = { userId: user._id, sessionId: session._id, user };
    next();
  };
}

/** Narrowing helper for handlers mounted behind `authenticate`. */
export function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw Errors.unauthenticated();
  return req.auth;
}
