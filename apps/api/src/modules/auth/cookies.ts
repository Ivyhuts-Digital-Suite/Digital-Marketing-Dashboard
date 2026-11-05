import type { CookieOptions, Request, Response } from 'express';
import { API_PREFIX, AUTH_COOKIES } from '@mp/shared';
import type { ServerConfig } from '../../config';

/** The refresh cookie is only sent to auth endpoints, limiting where it can leak. */
export const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

function baseOptions(config: ServerConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.auth.secureCookies,
    ...(config.auth.cookieDomain && { domain: config.auth.cookieDomain }),
  };
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export function setAuthCookies(res: Response, config: ServerConfig, tokens: IssuedTokens): void {
  res.cookie(AUTH_COOKIES.ACCESS, tokens.accessToken, {
    ...baseOptions(config),
    sameSite: 'lax',
    path: '/',
    maxAge: config.auth.accessTtlSeconds * 1000,
  });
  res.cookie(AUTH_COOKIES.REFRESH, tokens.refreshToken, {
    ...baseOptions(config),
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    expires: tokens.refreshExpiresAt,
  });
  res.cookie(AUTH_COOKIES.SESSION_HINT, '1', {
    ...baseOptions(config),
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    expires: tokens.refreshExpiresAt,
  });
}

export function clearAuthCookies(res: Response, config: ServerConfig): void {
  res.clearCookie(AUTH_COOKIES.ACCESS, { ...baseOptions(config), sameSite: 'lax', path: '/' });
  res.clearCookie(AUTH_COOKIES.REFRESH, { ...baseOptions(config), sameSite: 'strict', path: REFRESH_COOKIE_PATH });
  res.clearCookie(AUTH_COOKIES.SESSION_HINT, { ...baseOptions(config), httpOnly: false, sameSite: 'lax', path: '/' });
}

/** Access token from `Authorization: Bearer` (API clients) or the HttpOnly cookie (browsers). */
export function readAccessToken(req: Request): string | undefined {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || undefined;
  const cookie: unknown = req.cookies?.[AUTH_COOKIES.ACCESS];
  return typeof cookie === 'string' && cookie ? cookie : undefined;
}

export function readRefreshToken(req: Request): string | undefined {
  const cookie: unknown = req.cookies?.[AUTH_COOKIES.REFRESH];
  return typeof cookie === 'string' && cookie ? cookie : undefined;
}
