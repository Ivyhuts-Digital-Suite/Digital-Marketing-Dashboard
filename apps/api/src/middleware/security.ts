import type { RequestHandler } from 'express';
import type { CorsOptions } from 'cors';
import { ORGANIZATION_HEADER, REQUEST_ID_HEADER } from '@mp/shared';
import { Errors } from '../lib/errors';

const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 10;

function findDisallowedKey(value: unknown, depth = 0): string | null {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return null;
  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith('$') || PROTOTYPE_KEYS.has(key)) return key;
    const found = findDisallowedKey(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * NoSQL-injection and prototype-pollution guard: rejects request bodies, queries or
 * params containing `$`-prefixed operator keys or prototype keys. (Zod validation also
 * rejects non-primitive values where strings are expected; this is defense in depth.)
 */
export const rejectDisallowedKeys: RequestHandler = (req, _res, next) => {
  for (const part of [req.body, req.query, req.params]) {
    if (findDisallowedKey(part)) throw Errors.badRequest('Request contains disallowed keys');
  }
  next();
};

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defense for cookie-authenticated requests (complements SameSite cookies):
 * state-changing requests that carry an Origin header must come from an allowlisted
 * origin, and browsers reporting a cross-site fetch are rejected.
 */
export function verifyOrigin(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    if (!UNSAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (origin && !allowed.has(origin)) throw Errors.forbidden('Request origin is not allowed');
    if (req.get('sec-fetch-site') === 'cross-site') throw Errors.forbidden('Cross-site requests are not allowed');
    next();
  };
}

export function corsOptions(allowedOrigins: string[]): CorsOptions {
  const allowed = new Set(allowedOrigins);
  return {
    origin: (origin, callback) => callback(null, !origin || allowed.has(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', ORGANIZATION_HEADER, REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER],
    maxAge: 600,
  };
}
