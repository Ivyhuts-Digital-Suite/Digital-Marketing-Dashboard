import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadServerConfig } from '../src/server-env';
import { parseDurationToSeconds } from '../src/duration';

const VALID = {
  MONGODB_URI: 'mongodb+srv://user:pa55word@cluster0.example.mongodb.net/app',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
};

function issuesFor(env: Record<string, string | undefined>) {
  try {
    loadServerConfig(env);
  } catch (error) {
    if (error instanceof EnvValidationError) return error;
    throw error;
  }
  throw new Error('expected validation to fail');
}

describe('loadServerConfig', () => {
  it('accepts the minimal required set and applies defaults', () => {
    const config = loadServerConfig(VALID);
    expect(config).toMatchObject({
      env: 'development',
      isProduction: false,
      api: { port: 4000, url: 'http://localhost:4000' },
      web: { url: 'http://localhost:3000' },
      cors: { allowedOrigins: ['http://localhost:3000'] },
      redis: { url: undefined },
      auth: { accessTtlSeconds: 900, refreshTtlSeconds: 2_592_000, secureCookies: false },
      integrations: { googleAds: { configured: false }, meta: { configured: false } },
      storage: { provider: 'local' },
      email: { configured: false },
    });
  });

  it('does not require integration, AI, storage or email credentials', () => {
    expect(() => loadServerConfig({ ...VALID, OPENAI_API_KEY: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: '' })).not.toThrow();
  });

  it('fails fast on missing required variables, naming them without echoing values', () => {
    const error = issuesFor({ JWT_ACCESS_SECRET: 'super-secret-value-that-is-long-enough-xx' });
    const variables = error.issues.map((i) => i.variable);
    expect(variables).toEqual(expect.arrayContaining(['MONGODB_URI', 'JWT_REFRESH_SECRET']));
    expect(error.message).not.toContain('super-secret-value');
  });

  it('validates formats', () => {
    const error = issuesFor({
      ...VALID,
      MONGODB_URI: 'postgres://nope',
      API_PORT: '99999',
      REDIS_URL: 'http://not-redis',
      JWT_ACCESS_EXPIRES_IN: 'forever',
      WEB_URL: 'not a url',
    });
    expect(error.issues.map((i) => i.variable).sort()).toEqual(
      ['API_PORT', 'JWT_ACCESS_EXPIRES_IN', 'MONGODB_URI', 'REDIS_URL', 'WEB_URL'].sort(),
    );
  });

  it('requires strong, distinct JWT secrets', () => {
    expect(issuesFor({ ...VALID, JWT_ACCESS_SECRET: 'short' }).issues[0]?.variable).toBe('JWT_ACCESS_SECRET');
    expect(issuesFor({ ...VALID, JWT_REFRESH_SECRET: VALID.JWT_ACCESS_SECRET }).issues[0]?.variable).toBe('JWT_REFRESH_SECRET');
  });

  it('rejects placeholder secrets in production', () => {
    const error = issuesFor({ ...VALID, NODE_ENV: 'production', JWT_ACCESS_SECRET: 'change-me-change-me-change-me-change-me' });
    expect(error.issues.map((i) => i.variable)).toContain('JWT_ACCESS_SECRET');
  });

  it('rejects partially configured credential groups', () => {
    const error = issuesFor({ ...VALID, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' });
    expect(error.issues.map((i) => i.variable).sort()).toEqual(['GOOGLE_DEVELOPER_TOKEN', 'GOOGLE_REDIRECT_URI']);
    expect(issuesFor({ ...VALID, SMTP_USER: 'user' }).issues.map((i) => i.variable)).toContain('SMTP_PASSWORD');
    expect(issuesFor({ ...VALID, STORAGE_PROVIDER: 's3' }).issues).toHaveLength(4);
  });

  it('builds structured provider config when a group is complete', () => {
    const config = loadServerConfig({
      ...VALID,
      NODE_ENV: 'production',
      META_APP_ID: 'app',
      META_APP_SECRET: 'secret',
      META_REDIRECT_URI: 'https://api.example.com/meta/callback',
      CORS_ALLOWED_ORIGINS: 'https://admin.example.com, https://app.example.com',
      WEB_URL: 'https://app.example.com',
    });
    expect(config.integrations.meta).toEqual({
      configured: true,
      appId: 'app',
      appSecret: 'secret',
      redirectUri: 'https://api.example.com/meta/callback',
    });
    expect(config.auth.secureCookies).toBe(true);
    expect(config.cors.allowedOrigins).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });
});

describe('parseDurationToSeconds', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['12h', 43_200],
    ['30d', 2_592_000],
  ])('%s → %d', (input, expected) => expect(parseDurationToSeconds(input)).toBe(expected));

  it('rejects malformed durations', () => expect(() => parseDurationToSeconds('1w')).toThrow());
});
