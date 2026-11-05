import { Types } from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';
import { ORGANIZATION_HEADER, type OrganizationRole } from '@mp/shared';
import type { OrganizationWithMembershipDto } from '@mp/types';
import { AdAccountModel } from '../src/modules/integrations/ad-account.model';
import { IntegrationModel } from '../src/modules/integrations/integration.model';
import { OrganizationMemberModel } from '../src/modules/members/member.model';
import { addMember, buildApp, createOrganization, registerUser, useTestDatabase, type TestUser } from './helpers';

/**
 * Organization A and Organization B each have an owner. Every test proves that a user of
 * Organization B cannot read or change Organization A's records — whether they target A
 * directly (A's ID in the header/path) or reference A's record IDs from within B.
 */
useTestDatabase();
const app = buildApp();

let ownerA: TestUser;
let ownerB: TestUser;
let orgA: OrganizationWithMembershipDto;
let orgB: OrganizationWithMembershipDto;
let integrationA: string;
let invitationA: string;
let memberA: string;

beforeAll(async () => {
  ownerA = await registerUser(app, 'Owner A');
  ownerB = await registerUser(app, 'Owner B');
  orgA = await createOrganization(ownerA, 'Organization A');
  orgB = await createOrganization(ownerB, 'Organization B');

  const viewerA = await registerUser(app, 'Viewer A');
  memberA = await addMember(ownerA, orgA.id, viewerA, 'VIEWER' satisfies OrganizationRole);

  const integration = await IntegrationModel.create({
    organizationId: new Types.ObjectId(orgA.id),
    provider: 'GOOGLE_ADS',
    status: 'ACTIVE',
    displayName: 'A — Google Ads MCC',
    externalAccountId: '123-456-7890',
  });
  integrationA = String(integration._id);
  await AdAccountModel.create({
    organizationId: integration.organizationId,
    integrationId: integration._id,
    provider: 'GOOGLE_ADS',
    externalId: '111-222-3333',
    name: 'A — Brand Search',
  });

  const invite = await ownerA.agent
    .post('/api/v1/organization-members/invitations')
    .set(ORGANIZATION_HEADER, orgA.id)
    .send({ email: 'pending@example.test', role: 'VIEWER' });
  invitationA = invite.body.data.invitation.id;
});

describe('direct access to another organization', () => {
  it.each([
    ['get', '/api/v1/organization-members'],
    ['get', '/api/v1/organization-members/invitations'],
    ['post', '/api/v1/organization-members/invitations'],
    ['get', '/api/v1/integrations'],
    ['get', '/api/v1/audit-logs'],
  ] as const)('%s %s with Organization A in the header is denied', async (method, path) => {
    const res = await ownerB.agent[method](path).set(ORGANIZATION_HEADER, orgA.id).send({ email: 'x@example.test', role: 'VIEWER' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORGANIZATION_ACCESS_DENIED');
  });

  it('cannot read, update or archive Organization A by path', async () => {
    expect((await ownerB.agent.get(`/api/v1/organizations/${orgA.id}`)).status).toBe(403);
    expect((await ownerB.agent.patch(`/api/v1/organizations/${orgA.id}`).send({ name: 'Pwned' })).status).toBe(403);
    expect((await ownerB.agent.delete(`/api/v1/organizations/${orgA.id}`)).status).toBe(403);
  });

  it('cannot reach Organization A’s integration or ad accounts even with its ID', async () => {
    const asA = await ownerB.agent.get(`/api/v1/integrations/${integrationA}`).set(ORGANIZATION_HEADER, orgA.id);
    expect(asA.status).toBe(403);
  });

  it('nonexistent and malformed organization IDs are indistinguishable from forbidden ones', async () => {
    const missing = await ownerB.agent.get('/api/v1/organization-members').set(ORGANIZATION_HEADER, new Types.ObjectId().toString());
    const malformed = await ownerB.agent.get('/api/v1/organization-members').set(ORGANIZATION_HEADER, 'not-an-id');
    for (const res of [missing, malformed]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ORGANIZATION_ACCESS_DENIED');
    }
  });

  it('requires an organization header on tenant-scoped routes', async () => {
    const res = await ownerB.agent.get('/api/v1/integrations');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ORGANIZATION_REQUIRED');
  });
});

describe('referencing Organization A’s records from within Organization B', () => {
  it('integration lookups by ID are scoped to B and return 404', async () => {
    const get = await ownerB.agent.get(`/api/v1/integrations/${integrationA}`).set(ORGANIZATION_HEADER, orgB.id);
    const accounts = await ownerB.agent
      .get(`/api/v1/integrations/${integrationA}/ad-accounts`)
      .set(ORGANIZATION_HEADER, orgB.id);
    const disconnect = await ownerB.agent.delete(`/api/v1/integrations/${integrationA}`).set(ORGANIZATION_HEADER, orgB.id);
    for (const res of [get, accounts, disconnect]) expect(res.status).toBe(404);

    const stillActive = await IntegrationModel.findOne({ _id: integrationA, organizationId: orgA.id }).lean();
    expect(stillActive?.status).toBe('ACTIVE');
  });

  it('cannot change roles of, or remove, Organization A’s members', async () => {
    const patch = await ownerB.agent
      .patch(`/api/v1/organization-members/${memberA}`)
      .set(ORGANIZATION_HEADER, orgB.id)
      .send({ role: 'ADMIN' });
    const remove = await ownerB.agent.delete(`/api/v1/organization-members/${memberA}`).set(ORGANIZATION_HEADER, orgB.id);
    expect(patch.status).toBe(404);
    expect(remove.status).toBe(404);

    const unchanged = await OrganizationMemberModel.findOne({ _id: memberA, organizationId: orgA.id }).lean();
    expect(unchanged).toMatchObject({ role: 'VIEWER', status: 'ACTIVE' });
  });

  it('cannot revoke Organization A’s invitations', async () => {
    const res = await ownerB.agent
      .delete(`/api/v1/organization-members/invitations/${invitationA}`)
      .set(ORGANIZATION_HEADER, orgB.id);
    expect(res.status).toBe(404);
  });

  it('listings in B never include A’s data', async () => {
    const members = await ownerB.agent.get('/api/v1/organization-members').set(ORGANIZATION_HEADER, orgB.id);
    expect(members.body.data.members.every((m: { organizationId: string }) => m.organizationId === orgB.id)).toBe(true);
    expect(members.body.data.members).toHaveLength(1);

    const integrations = await ownerB.agent.get('/api/v1/integrations').set(ORGANIZATION_HEADER, orgB.id);
    const connections = integrations.body.data.providers.flatMap((p: { connections: unknown[] }) => p.connections);
    expect(connections).toEqual([]);

    const audit = await ownerB.agent.get('/api/v1/audit-logs').set(ORGANIZATION_HEADER, orgB.id);
    expect(audit.body.data.auditLogs.length).toBeGreaterThan(0);
    expect(audit.body.data.auditLogs.every((a: { organizationId: string }) => a.organizationId === orgB.id)).toBe(true);
  });

  it('ignores a client-supplied organizationId in request bodies', async () => {
    const res = await ownerB.agent
      .post('/api/v1/organization-members/invitations')
      .set(ORGANIZATION_HEADER, orgB.id)
      .send({ email: 'smuggle@example.test', role: 'VIEWER', organizationId: orgA.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
