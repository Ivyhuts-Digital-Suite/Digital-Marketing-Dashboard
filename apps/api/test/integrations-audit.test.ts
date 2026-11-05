import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { ORGANIZATION_HEADER } from '@mp/shared';
import { IntegrationModel } from '../src/modules/integrations/integration.model';
import {
  addMember,
  buildApp,
  buildContext,
  createOrganization,
  registerUser,
  testConfig,
  useTestDatabase,
} from './helpers';

useTestDatabase();
const app = buildApp();

describe('integration catalog', () => {
  it('reports providers as NOT_CONFIGURED when the server has no credentials', async () => {
    const owner = await registerUser(app);
    const org = await createOrganization(owner);
    const res = await owner.agent.get('/api/v1/integrations').set(ORGANIZATION_HEADER, org.id);
    expect(res.status).toBe(200);
    expect(res.body.data.providers).toEqual([
      expect.objectContaining({ provider: 'GOOGLE_ADS', availability: 'NOT_CONFIGURED', connections: [] }),
      expect.objectContaining({ provider: 'META_ADS', availability: 'NOT_CONFIGURED', connections: [] }),
    ]);
  });

  it('reports COMING_SOON when credentials exist, and connect is honestly not implemented', async () => {
    const configured = buildApp(
      buildContext(
        testConfig({
          GOOGLE_CLIENT_ID: 'client-id',
          GOOGLE_CLIENT_SECRET: 'client-secret',
          GOOGLE_DEVELOPER_TOKEN: 'dev-token',
          GOOGLE_REDIRECT_URI: 'http://localhost:4000/api/v1/integrations/google/callback',
        }),
      ),
    );
    const owner = await registerUser(configured);
    const org = await createOrganization(owner);

    const catalog = await owner.agent.get('/api/v1/integrations').set(ORGANIZATION_HEADER, org.id);
    const google = catalog.body.data.providers.find((p: { provider: string }) => p.provider === 'GOOGLE_ADS');
    expect(google.availability).toBe('COMING_SOON');

    const connect = await owner.agent
      .post('/api/v1/integrations/providers/GOOGLE_ADS/connect')
      .set(ORGANIZATION_HEADER, org.id);
    expect(connect.status).toBe(501);
    expect(connect.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('validates the provider parameter', async () => {
    const owner = await registerUser(app);
    const org = await createOrganization(owner);
    const res = await owner.agent.post('/api/v1/integrations/providers/TIKTOK/connect').set(ORGANIZATION_HEADER, org.id);
    expect(res.status).toBe(400);
  });

  it('disconnecting requires integrations:manage and is audited', async () => {
    const owner = await registerUser(app);
    const analyst = await registerUser(app);
    const org = await createOrganization(owner);
    await addMember(owner, org.id, analyst, 'MARKETING_ANALYST');
    const integration = await IntegrationModel.create({
      organizationId: new Types.ObjectId(org.id),
      provider: 'META_ADS',
      status: 'ACTIVE',
      displayName: 'Meta Business',
    });

    const denied = await analyst.agent.delete(`/api/v1/integrations/${integration._id}`).set(ORGANIZATION_HEADER, org.id);
    expect(denied.status).toBe(403);

    const ok = await owner.agent.delete(`/api/v1/integrations/${integration._id}`).set(ORGANIZATION_HEADER, org.id);
    expect(ok.status).toBe(200);
    expect(ok.body.data.integration.status).toBe('DISCONNECTED');

    const audit = await owner.agent
      .get('/api/v1/audit-logs?action=integration.disconnect')
      .set(ORGANIZATION_HEADER, org.id);
    expect(audit.body.data.auditLogs).toHaveLength(1);
    expect(audit.body.data.auditLogs[0]).toMatchObject({
      action: 'integration.disconnect',
      resourceType: 'Integration',
      resourceId: String(integration._id),
      metadata: { provider: 'META_ADS', previousStatus: 'ACTIVE' },
    });
  });
});

describe('audit log API', () => {
  it('returns the organization’s trail newest-first with actor details and pagination', async () => {
    const owner = await registerUser(app, 'Audit Owner');
    const org = await createOrganization(owner);
    await owner.agent.patch(`/api/v1/organizations/${org.id}`).send({ name: 'Renamed Once' });
    await owner.agent.patch(`/api/v1/organizations/${org.id}`).send({ name: 'Renamed Twice' });

    const res = await owner.agent.get('/api/v1/audit-logs?limit=2').set(ORGANIZATION_HEADER, org.id);
    expect(res.status).toBe(200);
    expect(res.body.meta.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    const [latest] = res.body.data.auditLogs;
    expect(latest).toMatchObject({
      action: 'organization.update',
      actor: { id: owner.user.id, name: 'Audit Owner', email: owner.email },
      metadata: { changes: { name: 'Renamed Twice' } },
    });
    expect(latest.ipAddress).toBeTruthy();
  });

  it('rejects invalid filters', async () => {
    const owner = await registerUser(app);
    const org = await createOrganization(owner);
    const res = await owner.agent.get('/api/v1/audit-logs?limit=1000&action=drop.tables').set(ORGANIZATION_HEADER, org.id);
    expect(res.status).toBe(400);
  });

  it('never records secrets: invitation tokens are absent from audit metadata', async () => {
    const owner = await registerUser(app);
    const org = await createOrganization(owner);
    const invite = await owner.agent
      .post('/api/v1/organization-members/invitations')
      .set(ORGANIZATION_HEADER, org.id)
      .send({ email: 'audit-secret@example.test', role: 'VIEWER' });
    const token = new URL(invite.body.data.acceptUrl).searchParams.get('token')!;

    const res = await owner.agent.get('/api/v1/audit-logs?action=invitation.create').set(ORGANIZATION_HEADER, org.id);
    expect(JSON.stringify(res.body)).not.toContain(token);
    expect(res.body.data.auditLogs[0].metadata).toMatchObject({ email: 'audit-secret@example.test', delivery: 'manual' });
  });
});
