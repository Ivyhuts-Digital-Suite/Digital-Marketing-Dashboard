import { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp, buildContext, registerUser, useTestDatabase } from './helpers';

useTestDatabase();
const app = buildApp();

describe('health endpoints', () => {
  it('GET /health reports liveness', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ok', service: 'marketing-platform-api' });
  });

  it('GET /health/ready reports MongoDB up and Redis not configured', async () => {
    const res = await request(app).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ready');
    expect(res.body.data.checks.mongodb.status).toBe('up');
    expect(res.body.data.checks.redis).toEqual({ status: 'not_configured' });
  });

  describe('with an unreachable Redis', () => {
    const redis = new Redis('redis://127.0.0.1:1', { lazyConnect: true, maxRetriesPerRequest: 0, retryStrategy: () => null });
    afterAll(() => redis.disconnect());

    it('returns 503 not_ready', async () => {
      const degraded = buildApp(buildContext(undefined, { redis }), {
        rateLimits: { globalPerMinute: 1000, authPer15Minutes: 1000, refreshPer15Minutes: 1000 },
      });
      // Use the in-memory rate-limit store (the limiter would otherwise use the broken Redis).
      const res = await request(degraded).get('/api/v1/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.data.status).toBe('not_ready');
      expect(res.body.data.checks.redis.status).toBe('down');
    });
  });
});

describe('API conventions and hardening', () => {
  it('returns a standard 404 envelope with a request ID for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('propagates a well-formed incoming request ID', async () => {
    const res = await request(app).get('/api/v1/health').set('X-Request-Id', 'trace-abc-12345');
    expect(res.headers['x-request-id']).toBe('trace-abc-12345');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('rejects NoSQL operator injection in bodies', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: { $gt: '' }, password: { $ne: null } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('does not parse nested query objects', async () => {
    const owner = await registerUser(app);
    const res = await owner.agent.get('/api/v1/organizations?status[$ne]=ARCHIVED');
    expect(res.status).toBe(200);
  });

  it('rejects prototype-pollution keys', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":"a@b.co","password":"x","__proto__":{"isAdmin":true}}');
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON with 400 and oversize bodies with 413', async () => {
    const malformed = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.message).toBe('Malformed JSON body');

    const huge = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'x'.repeat(200_000), email: 'a@b.co', password: 'x' });
    expect(huge.status).toBe(413);
    expect(huge.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('applies the CORS allowlist', async () => {
    const allowed = await request(app).options('/api/v1/auth/login').set('Origin', 'http://localhost:3000');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await request(app).options('/api/v1/auth/login').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('blocks state-changing requests from disallowed origins (CSRF defense)', async () => {
    const owner = await registerUser(app);
    const res = await owner.agent
      .post('/api/v1/organizations')
      .set('Origin', 'https://evil.example')
      .send({ name: 'CSRF Org' });
    expect(res.status).toBe(403);

    const crossSite = await owner.agent.post('/api/v1/organizations').set('Sec-Fetch-Site', 'cross-site').send({ name: 'CSRF Org' });
    expect(crossSite.status).toBe(403);
  });

  it('never leaks internal error details', async () => {
    const owner = await registerUser(app);
    const res = await owner.agent.patch('/api/v1/organizations/zzzz').send({ name: 'Nope' });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|mongo|Cast/i);
  });
});
