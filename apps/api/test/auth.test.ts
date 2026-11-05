import { SignJWT } from 'jose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AUTH_COOKIES } from '@mp/shared';
import { SessionModel } from '../src/modules/auth/session.model';
import { UserModel } from '../src/modules/users/user.model';
import { AuditLogModel } from '../src/modules/audit/audit-log.model';
import {
  BASE_TEST_ENV,
  TEST_PASSWORD,
  buildApp,
  buildContext,
  cookieValue,
  registerUser,
  setCookieHeader,
  uniqueEmail,
  useTestDatabase,
} from './helpers';

useTestDatabase();
const app = buildApp();

describe('registration', () => {
  it('creates a user, hashes the password and signs them in with HttpOnly cookies', async () => {
    const email = uniqueEmail('register');
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Ada Lovelace', email: email.toUpperCase(), password: TEST_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ email, name: 'Ada Lovelace', status: 'ACTIVE', platformRole: 'USER' });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);

    const access = setCookieHeader(res, AUTH_COOKIES.ACCESS)!;
    const refresh = setCookieHeader(res, AUTH_COOKIES.REFRESH)!;
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=Lax/i);
    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/SameSite=Strict/i);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);

    const stored = await UserModel.findOne({ email }).select('+passwordHash').lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored?.passwordHash).not.toContain(TEST_PASSWORD);
  });

  it('rejects a duplicate email with 409', async () => {
    const { email } = await registerUser(app);
    const res = await request(app).post('/api/v1/auth/register').send({ name: 'Dup', email, password: TEST_PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects invalid input with field-level validation errors', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['body.name', 'body.email', 'body.password']));
  });

  it('rejects unknown fields (no mass assignment of platformRole)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Eve', email: uniqueEmail(), password: TEST_PASSWORD, platformRole: 'SUPER_ADMIN' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('records an audit entry', async () => {
    const { user } = await registerUser(app);
    const entry = await AuditLogModel.findOne({ actorUserId: user.id, action: 'auth.register' })
      .setOptions({ skipTenantGuard: true })
      .lean();
    expect(entry).toBeTruthy();
    expect(entry?.organizationId).toBeNull();
  });
});

describe('login and logout', () => {
  it('signs in with valid credentials and returns the session from /auth/me', async () => {
    const { email } = await registerUser(app, 'Grace Hopper');
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.user.email).toBe(email);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.name).toBe('Grace Hopper');
    expect(me.body.data.organizations).toEqual([]);
  });

  it('returns the same generic error for a wrong password and an unknown email', async () => {
    const { email } = await registerUser(app);
    const wrongPassword = await request(app).post('/api/v1/auth/login').send({ email, password: 'Wrong-password-1' });
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail('nobody'), password: TEST_PASSWORD });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }
  });

  it('logout revokes the session server-side, so the old access token stops working', async () => {
    const { agent } = await registerUser(app);
    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);

    // Capture the access token before logout clears the cookie jar.
    const login = await agent.post('/api/v1/auth/login').send({ email: me.body.data.user.email, password: TEST_PASSWORD });
    const accessToken = cookieValue(login, AUTH_COOKIES.ACCESS)!;

    const logout = await agent.post('/api/v1/auth/logout');
    expect(logout.status).toBe(200);
    expect(setCookieHeader(logout, AUTH_COOKIES.ACCESS)).toMatch(/Expires=Thu, 01 Jan 1970/);

    const replay = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('logout-all revokes every session of the user', async () => {
    const { agent, email } = await registerUser(app);
    const second = request.agent(app);
    await second.post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });
    expect((await second.get('/api/v1/auth/me')).status).toBe(200);

    const res = await agent.post('/api/v1/auth/logout-all');
    expect(res.status).toBe(200);
    expect(res.body.data.revokedSessions).toBe(2);
    expect((await second.get('/api/v1/auth/me')).status).toBe(401);
  });
});

describe('refresh-token rotation', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const email = uniqueEmail('rotate');
    const register = await request(app).post('/api/v1/auth/register').send({ name: 'R', email, password: TEST_PASSWORD });
    const firstRefresh = cookieValue(register, AUTH_COOKIES.REFRESH)!;

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${AUTH_COOKIES.REFRESH}=${firstRefresh}`);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.rotated).toBe(true);

    const secondRefresh = cookieValue(refreshed, AUTH_COOKIES.REFRESH)!;
    const newAccess = cookieValue(refreshed, AUTH_COOKIES.ACCESS)!;
    expect(secondRefresh).toBeTruthy();
    expect(secondRefresh).not.toBe(firstRefresh);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${newAccess}`);
    expect(me.status).toBe(200);

    const session = await SessionModel.findOne({ userId: me.body.data.user.id }).lean();
    expect(session?.rotationCount).toBe(1);
    expect(session?.refreshTokenHash).not.toContain(secondRefresh);
  });

  it('detects reuse of a rotated token and revokes the whole session', async () => {
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'R', email: uniqueEmail('reuse'), password: TEST_PASSWORD });
    const token1 = cookieValue(register, AUTH_COOKIES.REFRESH)!;

    const r1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', `${AUTH_COOKIES.REFRESH}=${token1}`);
    const token2 = cookieValue(r1, AUTH_COOKIES.REFRESH)!;
    const r2 = await request(app).post('/api/v1/auth/refresh').set('Cookie', `${AUTH_COOKIES.REFRESH}=${token2}`);
    const token3 = cookieValue(r2, AUTH_COOKIES.REFRESH)!;
    expect(token3).toBeTruthy();

    // token1 is two rotations old: outside the concurrency grace window → theft.
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', `${AUTH_COOKIES.REFRESH}=${token1}`);
    expect(replay.status).toBe(401);

    // The legitimate latest token is now dead too, because the session was revoked.
    const latest = await request(app).post('/api/v1/auth/refresh').set('Cookie', `${AUTH_COOKIES.REFRESH}=${token3}`);
    expect(latest.status).toBe(401);

    const userId = register.body.data.user.id as string;
    const session = await SessionModel.findOne({ userId }).lean();
    expect(session?.revokedReason).toBe('reuse_detected');
    const audit = await AuditLogModel.findOne({ actorUserId: userId, action: 'auth.refresh_reuse_detected' })
      .setOptions({ skipTenantGuard: true })
      .lean();
    expect(audit).toBeTruthy();
  });

  it('tolerates the immediately previous token during the concurrency grace window', async () => {
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'R', email: uniqueEmail('race'), password: TEST_PASSWORD });
    const token1 = cookieValue(register, AUTH_COOKIES.REFRESH)!;

    await request(app).post('/api/v1/auth/refresh').set('Cookie', `${AUTH_COOKIES.REFRESH}=${token1}`);
    const concurrent = await request(app).post('/api/v1/auth/refresh').set('Cookie', `${AUTH_COOKIES.REFRESH}=${token1}`);
    expect(concurrent.status).toBe(200);
    expect(concurrent.body.data.rotated).toBe(false);
    expect(setCookieHeader(concurrent, AUTH_COOKIES.REFRESH)).toBeUndefined();
  });

  it('rejects refresh without a token, and access tokens presented as refresh tokens', async () => {
    const missing = await request(app).post('/api/v1/auth/refresh');
    expect(missing.status).toBe(401);

    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'R', email: uniqueEmail('confuse'), password: TEST_PASSWORD });
    const access = cookieValue(register, AUTH_COOKIES.ACCESS)!;
    const confused = await request(app).post('/api/v1/auth/refresh').set('Cookie', `${AUTH_COOKIES.REFRESH}=${access}`);
    expect(confused.status).toBe(401);
  });
});

describe('unauthorized requests', () => {
  it.each([
    ['get', '/api/v1/auth/me'],
    ['get', '/api/v1/users/me'],
    ['get', '/api/v1/organizations'],
    ['post', '/api/v1/organizations'],
    ['get', '/api/v1/organization-members'],
    ['get', '/api/v1/integrations'],
    ['get', '/api/v1/audit-logs'],
  ] as const)('%s %s without credentials returns 401', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: { code: 'UNAUTHENTICATED' } });
  });

  it('rejects a tampered or foreign-signed token', async () => {
    const forged = await new SignJWT({ sid: '0123456789abcdef01234567', typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('0123456789abcdef01234567')
      .setIssuer('marketing-platform-api')
      .setAudience('marketing-platform')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('an-attacker-controlled-secret-of-sufficient-length'));
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('reports TOKEN_EXPIRED for an expired access token so clients know to refresh', async () => {
    const expired = await new SignJWT({ sid: '0123456789abcdef01234567', typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('0123456789abcdef01234567')
      .setIssuer('marketing-platform-api')
      .setAudience('marketing-platform')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(BASE_TEST_ENV.JWT_ACCESS_SECRET));
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a suspended user even with a valid session', async () => {
    const { agent, user } = await registerUser(app);
    await UserModel.updateOne({ _id: user.id }, { $set: { status: 'SUSPENDED' } });
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });
});

describe('brute-force protection', () => {
  it('locks the account after repeated failures, even for the correct password', async () => {
    const { email } = await registerUser(app);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Wrong-password-1' });
      expect(res.status).toBe(401);
    }
    const locked = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('rate-limits credential endpoints per client', async () => {
    const limited = buildApp(buildContext(), {
      rateLimits: { globalPerMinute: 1000, authPer15Minutes: 3, refreshPer15Minutes: 1000 },
    });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await request(limited)
        .post('/api/v1/auth/login')
        .send({ email: uniqueEmail(), password: 'Wrong-password-1' });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([401, 401, 401, 429]);
  });
});

describe('password change', () => {
  it('requires the current password and revokes other sessions', async () => {
    const { agent, email } = await registerUser(app);
    const other = request.agent(app);
    await other.post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });

    const wrong = await agent
      .post('/api/v1/users/me/password')
      .send({ currentPassword: 'Not-the-password-1', newPassword: 'A-brand-new-passphrase-9' });
    expect(wrong.status).toBe(400);

    const ok = await agent
      .post('/api/v1/users/me/password')
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'A-brand-new-passphrase-9' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.revokedSessions).toBe(1);

    expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
    expect((await other.get('/api/v1/auth/me')).status).toBe(401);

    const relogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'A-brand-new-passphrase-9' });
    expect(relogin.status).toBe(200);
  });
});
