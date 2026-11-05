import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, inject } from 'vitest';
import { loadServerConfig, type ServerConfig } from '@mp/config/server-env';
import { ORGANIZATION_HEADER, type OrganizationRole } from '@mp/shared';
import type { OrganizationWithMembershipDto, UserDto } from '@mp/types';
import { createApp, type AppOptions } from '../src/app';
import { createAppContext, type AppContext } from '../src/app-context';
import { createLogger } from '../src/lib/logger';
import { createMailer } from '../src/lib/mailer';
import '../src/models';

export const TEST_PASSWORD = 'Correct-Horse-42-Battery';

export const BASE_TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  WEB_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:4000',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789-abcdefghijklmnop',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789-abcdefghijklmnop',
};

export function testConfig(overrides: Record<string, string> = {}): ServerConfig {
  return loadServerConfig({ ...BASE_TEST_ENV, MONGODB_URI: inject('mongoUri'), ...overrides });
}

export function buildContext(config: ServerConfig = testConfig(), extra: Partial<AppContext> = {}): AppContext {
  const logger = createLogger({ level: 'silent' });
  return {
    ...createAppContext({ config, logger, mailer: createMailer(config, logger, undefined, null) }),
    ...extra,
  };
}

/** Large limits so suites are not throttled; rate-limit tests build their own app. */
export const RELAXED_LIMITS: AppOptions = {
  rateLimits: { globalPerMinute: 100_000, authPer15Minutes: 100_000, refreshPer15Minutes: 100_000 },
};

export function buildApp(ctx: AppContext = buildContext(), options: AppOptions = RELAXED_LIMITS): Express {
  return createApp(ctx, options);
}

/** Connects Mongoose to an isolated database for the current test file and drops it afterwards. */
export function useTestDatabase(): void {
  beforeAll(async () => {
    await mongoose.connect(inject('mongoUri'), { dbName: `test_${randomUUID().replace(/-/g, '')}` });
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).createIndexes()));
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}

let counter = 0;
export function uniqueEmail(prefix = 'user'): string {
  counter += 1;
  return `${prefix}.${counter}.${randomUUID().slice(0, 8)}@example.test`;
}

export interface TestUser {
  agent: ReturnType<typeof request.agent>;
  user: UserDto;
  email: string;
}

/** Registers a user through the API and returns a cookie-holding agent signed in as them. */
export async function registerUser(app: Express, name = 'Test User', email = uniqueEmail()): Promise<TestUser> {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/register').send({ name, email, password: TEST_PASSWORD });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.data.user, email };
}

export async function createOrganization(user: TestUser, name = 'Acme Marketing'): Promise<OrganizationWithMembershipDto> {
  const res = await user.agent.post('/api/v1/organizations').send({ name });
  if (res.status !== 201) throw new Error(`create org failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.organization;
}

/** Invites `invitee` into `org` with `role` (as `inviter`) and accepts it. Returns the membership ID. */
export async function addMember(
  inviter: TestUser,
  orgId: string,
  invitee: TestUser,
  role: OrganizationRole,
): Promise<string> {
  const invite = await inviter.agent
    .post('/api/v1/organization-members/invitations')
    .set(ORGANIZATION_HEADER, orgId)
    .send({ email: invitee.email, role });
  if (invite.status !== 201) throw new Error(`invite failed: ${invite.status} ${JSON.stringify(invite.body)}`);
  const token = new URL(invite.body.data.acceptUrl as string).searchParams.get('token');
  const accept = await invitee.agent.post('/api/v1/organization-members/invitations/accept').send({ token });
  if (accept.status !== 200) throw new Error(`accept failed: ${accept.status} ${JSON.stringify(accept.body)}`);
  return accept.body.data.organization.membership.id as string;
}

/** Extracts `name=value` pairs from Set-Cookie headers. */
export function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const match = raw?.find((cookie) => cookie.startsWith(`${name}=`));
  return match?.split(';')[0]?.slice(name.length + 1);
}

export function setCookieHeader(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((cookie) => cookie.startsWith(`${name}=`));
}
