import type { RequestHandler } from 'express';
import { rateLimit, type Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { Redis } from 'ioredis';
import { Errors } from '../lib/errors';

export interface RateLimitSettings {
  /** General API traffic per client IP per minute. */
  globalPerMinute: number;
  /** Credential endpoints (login, register) per client IP per 15 minutes. */
  authPer15Minutes: number;
  /** Token refreshes per client IP per 15 minutes. */
  refreshPer15Minutes: number;
}

export const DEFAULT_RATE_LIMITS: RateLimitSettings = {
  globalPerMinute: 300,
  authPer15Minutes: 20,
  refreshPer15Minutes: 120,
};

export interface RateLimiters {
  global: RequestHandler;
  auth: RequestHandler;
  refresh: RequestHandler;
}

/**
 * Rate limiters keyed by client IP. With Redis configured, counters are shared across API
 * instances; otherwise they are per-process (fine for a single instance / development).
 * Brute-force protection is layered with per-account lockout in AuthService.
 */
export function createRateLimiters(settings: RateLimitSettings, redis?: Redis): RateLimiters {
  const make = (name: string, windowMs: number, limit: number): RequestHandler => {
    const options: Partial<Options> = {
      windowMs,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) => next(Errors.rateLimited()),
    };
    if (redis) {
      options.store = new RedisStore({
        prefix: `rl:${name}:`,
        sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
      });
    }
    return rateLimit(options);
  };

  return {
    global: make('global', 60_000, settings.globalPerMinute),
    auth: make('auth', 15 * 60_000, settings.authPer15Minutes),
    refresh: make('refresh', 15 * 60_000, settings.refreshPer15Minutes),
  };
}
