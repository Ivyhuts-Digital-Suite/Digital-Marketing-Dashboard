import { errors as joseErrors, jwtVerify, SignJWT, type JWTPayload } from 'jose';
import type { ServerConfig } from '../../config';
import { Errors } from '../../lib/errors';

const ISSUER = 'marketing-platform-api';
const AUDIENCE = 'marketing-platform';
const ALGORITHM = 'HS256';

export interface AccessClaims {
  userId: string;
  sessionId: string;
}

export interface RefreshClaims extends AccessClaims {
  tokenId: string;
}

/**
 * Signs and verifies JWTs. Access and refresh tokens use separate secrets and a `typ`
 * claim, so one can never be accepted as the other.
 */
export class TokenService {
  private readonly accessKey: Uint8Array;
  private readonly refreshKey: Uint8Array;

  constructor(private readonly config: ServerConfig) {
    this.accessKey = new TextEncoder().encode(config.auth.accessSecret);
    this.refreshKey = new TextEncoder().encode(config.auth.refreshSecret);
  }

  get accessTtlSeconds(): number {
    return this.config.auth.accessTtlSeconds;
  }

  get refreshTtlSeconds(): number {
    return this.config.auth.refreshTtlSeconds;
  }

  signAccessToken(claims: AccessClaims): Promise<string> {
    return new SignJWT({ sid: claims.sessionId, typ: 'access' })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + this.config.auth.accessTtlSeconds)
      .sign(this.accessKey);
  }

  /** Refresh tokens expire with their session (absolute lifetime; rotation does not extend it). */
  signRefreshToken(claims: RefreshClaims, expiresAt: Date): Promise<string> {
    return new SignJWT({ sid: claims.sessionId, typ: 'refresh' })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(claims.userId)
      .setJti(claims.tokenId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.refreshKey);
  }

  async verifyAccessToken(token: string): Promise<AccessClaims> {
    const payload = await this.verify(token, this.accessKey, 'access');
    return { userId: payload.sub!, sessionId: payload.sid as string };
  }

  async verifyRefreshToken(token: string): Promise<RefreshClaims> {
    const payload = await this.verify(token, this.refreshKey, 'refresh');
    if (!payload.jti) throw Errors.unauthenticated('Invalid refresh token');
    return { userId: payload.sub!, sessionId: payload.sid as string, tokenId: payload.jti };
  }

  private async verify(token: string, key: Uint8Array, type: 'access' | 'refresh'): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (payload.typ !== type || !payload.sub || typeof payload.sid !== 'string') {
        throw Errors.unauthenticated(`Invalid ${type} token`);
      }
      return payload;
    } catch (error) {
      if (error instanceof joseErrors.JWTExpired) {
        throw type === 'access' ? Errors.tokenExpired() : Errors.unauthenticated('Session has expired');
      }
      if (error instanceof joseErrors.JOSEError) throw Errors.unauthenticated(`Invalid ${type} token`);
      throw error;
    }
  }
}
