import { z } from 'zod';
import { DURATION_PATTERN, parseDurationToSeconds } from './duration';

/**
 * Server-side environment contract for the API and worker processes.
 *
 * Rules:
 * - Required variables fail fast at startup.
 * - Integration credentials are optional, but a provider group must be either fully
 *   configured or fully empty, so half-configured providers never reach runtime.
 * - Error messages name the variable and the problem; values are never echoed.
 */

const PLACEHOLDER_SECRET = /change[-_]?me|placeholder|example|secret123/i;

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalString = z.preprocess(blankToUndefined, z.string().trim().min(1).optional());
const optionalUrl = z.preprocess(blankToUndefined, z.url().optional());
const duration = (fallback: string) =>
  z.preprocess(
    blankToUndefined,
    z.string().regex(DURATION_PATTERN, 'Must be a duration such as 15m, 12h or 30d').default(fallback),
  );

const rawServerEnvSchema = z.object({
  // Application
  NODE_ENV: z.preprocess(blankToUndefined, z.enum(['development', 'test', 'production']).default('development')),
  WEB_URL: z.preprocess(blankToUndefined, z.url().default('http://localhost:3000')),
  API_URL: z.preprocess(blankToUndefined, z.url().default('http://localhost:4000')),
  API_PORT: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(65535).default(4000)),
  LOG_LEVEL: z.preprocess(
    blankToUndefined,
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ),
  CORS_ALLOWED_ORIGINS: optionalString,
  TRUST_PROXY: z.preprocess(blankToUndefined, z.coerce.number().int().min(0).max(10).default(0)),
  COOKIE_DOMAIN: optionalString,

  // Database
  MONGODB_URI: z.preprocess(
    blankToUndefined,
    z
      .string({ error: 'Required' })
      .regex(/^mongodb(\+srv)?:\/\//, 'Must be a mongodb:// or mongodb+srv:// connection string'),
  ),
  MONGODB_DB_NAME: optionalString,
  REDIS_URL: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^rediss?:\/\//, 'Must be a redis:// or rediss:// connection string')
      .optional(),
  ),

  // Authentication
  JWT_ACCESS_SECRET: z.preprocess(
    blankToUndefined,
    z.string({ error: 'Required' }).min(32, 'Must be at least 32 characters'),
  ),
  JWT_REFRESH_SECRET: z.preprocess(
    blankToUndefined,
    z.string({ error: 'Required' }).min(32, 'Must be at least 32 characters'),
  ),
  JWT_ACCESS_EXPIRES_IN: duration('15m'),
  JWT_REFRESH_EXPIRES_IN: duration('30d'),

  // Google Ads (planned integration)
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_DEVELOPER_TOKEN: optionalString,
  GOOGLE_REDIRECT_URI: optionalUrl,

  // Meta (planned integration)
  META_APP_ID: optionalString,
  META_APP_SECRET: optionalString,
  META_REDIRECT_URI: optionalUrl,

  // AI providers (planned)
  OPENAI_API_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  GOOGLE_GEMINI_API_KEY: optionalString,

  // Storage
  STORAGE_PROVIDER: z.preprocess(blankToUndefined, z.enum(['local', 's3']).default('local')),
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_BUCKET: optionalString,
  S3_REGION: optionalString,

  // Email
  SMTP_HOST: optionalString,
  SMTP_PORT: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(65535).optional()),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  EMAIL_FROM: optionalString,
});

type RawServerEnv = z.infer<typeof rawServerEnvSchema>;

const CREDENTIAL_GROUPS: Array<{ name: string; keys: Array<keyof RawServerEnv> }> = [
  {
    name: 'Google Ads',
    keys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_DEVELOPER_TOKEN', 'GOOGLE_REDIRECT_URI'],
  },
  { name: 'Meta', keys: ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI'] },
  { name: 'SMTP', keys: ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_FROM'] },
  { name: 'SMTP authentication', keys: ['SMTP_USER', 'SMTP_PASSWORD'] },
];

const serverEnvSchema = rawServerEnvSchema.superRefine((env, ctx) => {
  for (const group of CREDENTIAL_GROUPS) {
    const present = group.keys.filter((key) => env[key] !== undefined);
    if (present.length > 0 && present.length < group.keys.length) {
      for (const key of group.keys.filter((k) => env[k] === undefined)) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `Required when any ${group.name} variable is set (${group.name} is partially configured)`,
        });
      }
    }
  }

  if (env.STORAGE_PROVIDER === 's3') {
    for (const key of ['S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET', 'S3_REGION'] as const) {
      if (env[key] === undefined) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'Required when STORAGE_PROVIDER=s3' });
      }
    }
  }

  if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    ctx.addIssue({
      code: 'custom',
      path: ['JWT_REFRESH_SECRET'],
      message: 'Must differ from JWT_ACCESS_SECRET',
    });
  }

  if (env.NODE_ENV === 'production') {
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (env[key] && PLACEHOLDER_SECRET.test(env[key])) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'Looks like a placeholder; use a generated secret in production' });
      }
    }
  }
});

export interface ServerConfig {
  env: RawServerEnv['NODE_ENV'];
  isProduction: boolean;
  isTest: boolean;
  logLevel: RawServerEnv['LOG_LEVEL'];
  api: { port: number; url: string };
  web: { url: string };
  cors: { allowedOrigins: string[] };
  trustProxy: number;
  database: { uri: string; dbName: string | undefined };
  redis: { url: string | undefined };
  auth: {
    accessSecret: string;
    refreshSecret: string;
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
    cookieDomain: string | undefined;
    secureCookies: boolean;
  };
  integrations: {
    googleAds:
      | { configured: true; clientId: string; clientSecret: string; developerToken: string; redirectUri: string }
      | { configured: false };
    meta:
      | { configured: true; appId: string; appSecret: string; redirectUri: string }
      | { configured: false };
  };
  ai: { openaiApiKey?: string; anthropicApiKey?: string; geminiApiKey?: string };
  storage:
    | { provider: 'local' }
    | { provider: 's3'; accessKey: string; secretKey: string; bucket: string; region: string };
  email:
    | { configured: true; host: string; port: number; user?: string; password?: string; from: string }
    | { configured: false };
}

export interface EnvIssue {
  variable: string;
  message: string;
}

export class EnvValidationError extends Error {
  readonly issues: EnvIssue[];

  constructor(issues: EnvIssue[]) {
    super(
      `Invalid environment configuration:\n${issues.map((i) => `  - ${i.variable}: ${i.message}`).join('\n')}`,
    );
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

function toConfig(env: RawServerEnv): ServerConfig {
  const isProduction = env.NODE_ENV === 'production';
  const extraOrigins = (env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Optional fields are only spread when present so the config object never carries undefined secrets.
  const ai: ServerConfig['ai'] = {
    ...(env.OPENAI_API_KEY && { openaiApiKey: env.OPENAI_API_KEY }),
    ...(env.ANTHROPIC_API_KEY && { anthropicApiKey: env.ANTHROPIC_API_KEY }),
    ...(env.GOOGLE_GEMINI_API_KEY && { geminiApiKey: env.GOOGLE_GEMINI_API_KEY }),
  };

  return {
    env: env.NODE_ENV,
    isProduction,
    isTest: env.NODE_ENV === 'test',
    logLevel: env.LOG_LEVEL,
    api: { port: env.API_PORT, url: env.API_URL },
    web: { url: env.WEB_URL },
    cors: { allowedOrigins: [...new Set([new URL(env.WEB_URL).origin, ...extraOrigins])] },
    trustProxy: env.TRUST_PROXY,
    database: { uri: env.MONGODB_URI, dbName: env.MONGODB_DB_NAME },
    redis: { url: env.REDIS_URL },
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtlSeconds: parseDurationToSeconds(env.JWT_ACCESS_EXPIRES_IN),
      refreshTtlSeconds: parseDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN),
      cookieDomain: env.COOKIE_DOMAIN,
      secureCookies: isProduction,
    },
    integrations: {
      googleAds:
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_DEVELOPER_TOKEN && env.GOOGLE_REDIRECT_URI
          ? {
              configured: true,
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              developerToken: env.GOOGLE_DEVELOPER_TOKEN,
              redirectUri: env.GOOGLE_REDIRECT_URI,
            }
          : { configured: false },
      meta:
        env.META_APP_ID && env.META_APP_SECRET && env.META_REDIRECT_URI
          ? { configured: true, appId: env.META_APP_ID, appSecret: env.META_APP_SECRET, redirectUri: env.META_REDIRECT_URI }
          : { configured: false },
    },
    ai,
    storage:
      env.STORAGE_PROVIDER === 's3'
        ? {
            provider: 's3',
            accessKey: env.S3_ACCESS_KEY!,
            secretKey: env.S3_SECRET_KEY!,
            bucket: env.S3_BUCKET!,
            region: env.S3_REGION!,
          }
        : { provider: 'local' },
    email:
      env.SMTP_HOST && env.SMTP_PORT && env.EMAIL_FROM
        ? {
            configured: true,
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            from: env.EMAIL_FROM,
            ...(env.SMTP_USER && env.SMTP_PASSWORD && { user: env.SMTP_USER, password: env.SMTP_PASSWORD }),
          }
        : { configured: false },
  };
}

/**
 * Validates the given environment and returns a typed, structured configuration.
 * Throws EnvValidationError (which never contains secret values) when invalid.
 */
export function loadServerConfig(source: Record<string, string | undefined> = process.env): ServerConfig {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => ({
        variable: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    );
  }
  return toConfig(result.data);
}
