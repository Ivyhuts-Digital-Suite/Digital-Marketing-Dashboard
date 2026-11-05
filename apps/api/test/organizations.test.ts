import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ORGANIZATION_HEADER } from '@mp/shared';
import { OrganizationMemberModel } from '../src/modules/members/member.model';
import { OrganizationModel } from '../src/modules/organizations/organization.model';
import { UserModel } from '../src/modules/users/user.model';
import { AuditLogModel } from '../src/modules/audit/audit-log.model';
import { addMember, buildApp, createOrganization, registerUser, useTestDatabase } from './helpers';

useTestDatabase();
const app = buildApp();

describe('organization creation', () => {
  it('creates an organization and makes the creator its owner', async () => {
    const owner = await registerUser(app, 'Olivia Owner');
    const res = await owner.agent
      .post('/api/v1/organizations')
      .send({ name: 'Northwind Growth', timezone: 'Europe/London', currency: 'gbp' });

    expect(res.status).toBe(201);
    const org = res.body.data.organization;
    expect(org).toMatchObject({ name: 'Northwind Growth', slug: 'northwind-growth', timezone: 'Europe/London', currency: 'GBP' });
    expect(org.membership.role).toBe('ORGANIZATION_OWNER');
    expect(org.membership.permissions).toContain('organization:archive');
    expect(org.membership.permissions).not.toContain('campaigns:create');

    const membership = await OrganizationMemberModel.findOne({ organizationId: org.id, userId: owner.user.id }).lean();
    expect(membership?.status).toBe('ACTIVE');

    const audit = await AuditLogModel.findOne({ organizationId: org.id, action: 'organization.create' }).lean();
    expect(audit?.actorUserId?.toString()).toBe(owner.user.id);
  });

  it('generates a unique slug when the name collides and rejects a taken explicit slug', async () => {
    const owner = await registerUser(app);
    const first = await createOrganization(owner, 'Same Name Co');
    const second = await createOrganization(owner, 'Same Name Co');
    expect(first.slug).toBe('same-name-co');
    expect(second.slug).not.toBe(first.slug);
    expect(second.slug.startsWith('same-name-co-')).toBe(true);

    const taken = await owner.agent.post('/api/v1/organizations').send({ name: 'Other', slug: 'same-name-co' });
    expect(taken.status).toBe(409);
  });

  it('validates input', async () => {
    const owner = await registerUser(app);
    const res = await owner.agent.post('/api/v1/organizations').send({ name: 'X', timezone: 'Mars/Olympus', currency: 'dollars' });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['body.name', 'body.timezone', 'body.currency']));
  });

  it('lists only the organizations the user is an active member of', async () => {
    const alice = await registerUser(app);
    const bob = await registerUser(app);
    const a1 = await createOrganization(alice, 'Alice One');
    await createOrganization(bob, 'Bob One');

    const res = await alice.agent.get('/api/v1/organizations');
    expect(res.status).toBe(200);
    expect(res.body.data.organizations.map((o: { id: string }) => o.id)).toEqual([a1.id]);
  });
});

describe('organization management', () => {
  it('owner can read and update; changes are audited', async () => {
    const owner = await registerUser(app);
    const org = await createOrganization(owner, 'Update Me');

    const read = await owner.agent.get(`/api/v1/organizations/${org.id}`);
    expect(read.status).toBe(200);
    expect(read.body.data.organization.membership.role).toBe('ORGANIZATION_OWNER');

    const update = await owner.agent.patch(`/api/v1/organizations/${org.id}`).send({ name: 'Updated Name' });
    expect(update.status).toBe(200);
    expect(update.body.data.organization.name).toBe('Updated Name');

    const audit = await AuditLogModel.findOne({ organizationId: org.id, action: 'organization.update' }).lean();
    expect(audit?.metadata).toMatchObject({ changes: { name: 'Updated Name' } });
  });

  it('rejects an empty update', async () => {
    const owner = await registerUser(app);
    const org = await createOrganization(owner);
    const res = await owner.agent.patch(`/api/v1/organizations/${org.id}`).send({});
    expect(res.status).toBe(400);
  });

  it('only owners can archive; archived organizations become inaccessible', async () => {
    const owner = await registerUser(app);
    const admin = await registerUser(app);
    const org = await createOrganization(owner, 'Archive Me');
    await addMember(owner, org.id, admin, 'ADMIN');

    const denied = await admin.agent.delete(`/api/v1/organizations/${org.id}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const archived = await owner.agent.delete(`/api/v1/organizations/${org.id}`);
    expect(archived.status).toBe(200);
    const stored = await OrganizationModel.findById(org.id).lean();
    expect(stored?.status).toBe('ARCHIVED');
    expect(stored?.archivedAt).toBeInstanceOf(Date);

    expect((await owner.agent.get(`/api/v1/organizations/${org.id}`)).status).toBe(403);
    expect((await owner.agent.get('/api/v1/organizations')).body.data.organizations).toEqual([]);
  });
});

describe('memberships and invitations', () => {
  it('invites, accepts and lists members (manual delivery without SMTP)', async () => {
    const owner = await registerUser(app, 'Owner');
    const invitee = await registerUser(app, 'Invitee');
    const org = await createOrganization(owner);

    const invite = await owner.agent
      .post('/api/v1/organization-members/invitations')
      .set(ORGANIZATION_HEADER, org.id)
      .send({ email: invitee.email, role: 'MARKETING_ANALYST' });
    expect(invite.status).toBe(201);
    expect(invite.body.data.delivery).toBe('manual');
    expect(invite.body.data.acceptUrl).toMatch(/^http:\/\/localhost:3000\/invitations\/accept\?token=/);
    expect(invite.body.data.invitation).toMatchObject({ email: invitee.email, role: 'MARKETING_ANALYST', status: 'PENDING' });

    const pending = await owner.agent.get('/api/v1/organization-members/invitations').set(ORGANIZATION_HEADER, org.id);
    expect(pending.body.data.invitations).toHaveLength(1);

    const token = new URL(invite.body.data.acceptUrl).searchParams.get('token');
    const accept = await invitee.agent.post('/api/v1/organization-members/invitations/accept').send({ token });
    expect(accept.status).toBe(200);
    expect(accept.body.data.organization.membership.role).toBe('MARKETING_ANALYST');

    const again = await invitee.agent.post('/api/v1/organization-members/invitations/accept').send({ token });
    expect(again.status).toBe(404);

    const members = await invitee.agent.get('/api/v1/organization-members').set(ORGANIZATION_HEADER, org.id);
    expect(members.status).toBe(200);
    expect(members.body.data.members.map((m: { role: string }) => m.role).sort()).toEqual([
      'MARKETING_ANALYST',
      'ORGANIZATION_OWNER',
    ]);
  });

  it('refuses acceptance by a user whose email does not match the invitation', async () => {
    const owner = await registerUser(app);
    const intended = await registerUser(app);
    const intruder = await registerUser(app);
    const org = await createOrganization(owner);
    const invite = await owner.agent
      .post('/api/v1/organization-members/invitations')
      .set(ORGANIZATION_HEADER, org.id)
      .send({ email: intended.email, role: 'VIEWER' });
    const token = new URL(invite.body.data.acceptUrl).searchParams.get('token');

    const res = await intruder.agent.post('/api/v1/organization-members/invitations/accept').send({ token });
    expect(res.status).toBe(403);
  });

  it('rejects duplicate pending invitations and inviting existing members', async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app);
    const org = await createOrganization(owner);
    await addMember(owner, org.id, member, 'VIEWER');

    const existing = await owner.agent
      .post('/api/v1/organization-members/invitations')
      .set(ORGANIZATION_HEADER, org.id)
      .send({ email: member.email, role: 'VIEWER' });
    expect(existing.status).toBe(409);

    const send = () =>
      owner.agent
        .post('/api/v1/organization-members/invitations')
        .set(ORGANIZATION_HEADER, org.id)
        .send({ email: 'new.person@example.test', role: 'VIEWER' });
    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(409);
  });

  it('revoked invitations cannot be accepted', async () => {
    const owner = await registerUser(app);
    const invitee = await registerUser(app);
    const org = await createOrganization(owner);
    const invite = await owner.agent
      .post('/api/v1/organization-members/invitations')
      .set(ORGANIZATION_HEADER, org.id)
      .send({ email: invitee.email, role: 'VIEWER' });

    const revoke = await owner.agent
      .delete(`/api/v1/organization-members/invitations/${invite.body.data.invitation.id}`)
      .set(ORGANIZATION_HEADER, org.id);
    expect(revoke.status).toBe(200);

    const token = new URL(invite.body.data.acceptUrl).searchParams.get('token');
    const accept = await invitee.agent.post('/api/v1/organization-members/invitations/accept').send({ token });
    expect(accept.status).toBe(404);
  });

  it('removed members lose access immediately', async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app);
    const org = await createOrganization(owner);
    const memberId = await addMember(owner, org.id, member, 'SALES_REPRESENTATIVE');

    expect((await member.agent.get('/api/v1/organization-members').set(ORGANIZATION_HEADER, org.id)).status).toBe(200);
    const removed = await owner.agent.delete(`/api/v1/organization-members/${memberId}`).set(ORGANIZATION_HEADER, org.id);
    expect(removed.status).toBe(200);

    const after = await member.agent.get('/api/v1/organization-members').set(ORGANIZATION_HEADER, org.id);
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe('ORGANIZATION_ACCESS_DENIED');
  });
});

describe('RBAC permission enforcement', () => {
  it('denies actions outside a role’s permissions', async () => {
    const owner = await registerUser(app);
    const viewer = await registerUser(app);
    const analyst = await registerUser(app);
    const org = await createOrganization(owner);
    await addMember(owner, org.id, viewer, 'VIEWER');
    const analystId = await addMember(owner, org.id, analyst, 'MARKETING_ANALYST');

    const viewerInvite = await viewer.agent
      .post('/api/v1/organization-members/invitations')
      .set(ORGANIZATION_HEADER, org.id)
      .send({ email: 'x@example.test', role: 'VIEWER' });
    expect(viewerInvite.status).toBe(403);
    expect(viewerInvite.body.error.code).toBe('FORBIDDEN');

    const viewerUpdate = await viewer.agent.patch(`/api/v1/organizations/${org.id}`).send({ name: 'Hacked' });
    expect(viewerUpdate.status).toBe(403);

    const viewerAudit = await viewer.agent.get('/api/v1/audit-logs').set(ORGANIZATION_HEADER, org.id);
    expect(viewerAudit.status).toBe(403);

    const analystRoleChange = await analyst.agent
      .patch(`/api/v1/organization-members/${analystId}`)
      .set(ORGANIZATION_HEADER, org.id)
      .send({ role: 'ADMIN' });
    expect(analystRoleChange.status).toBe(403);

    // Read access that the role does grant still works.
    expect((await viewer.agent.get(`/api/v1/organizations/${org.id}`)).status).toBe(200);
    expect((await viewer.agent.get('/api/v1/integrations').set(ORGANIZATION_HEADER, org.id)).status).toBe(200);
  });

  it('admins cannot grant ownership or manage owners; nobody can change their own role', async () => {
    const owner = await registerUser(app);
    const admin = await registerUser(app);
    const viewer = await registerUser(app);
    const org = await createOrganization(owner);
    const adminId = await addMember(owner, org.id, admin, 'ADMIN');
    const viewerId = await addMember(owner, org.id, viewer, 'VIEWER');

    const toOwner = await admin.agent
      .patch(`/api/v1/organization-members/${viewerId}`)
      .set(ORGANIZATION_HEADER, org.id)
      .send({ role: 'ORGANIZATION_OWNER' });
    expect(toOwner.status).toBe(403);

    const toAdmin = await admin.agent
      .patch(`/api/v1/organization-members/${viewerId}`)
      .set(ORGANIZATION_HEADER, org.id)
      .send({ role: 'ADMIN' });
    expect(toAdmin.status).toBe(403);

    const promote = await admin.agent
      .patch(`/api/v1/organization-members/${viewerId}`)
      .set(ORGANIZATION_HEADER, org.id)
      .send({ role: 'MARKETING_MANAGER' });
    expect(promote.status).toBe(200);
    expect(promote.body.data.member.role).toBe('MARKETING_MANAGER');

    const self = await admin.agent
      .patch(`/api/v1/organization-members/${adminId}`)
      .set(ORGANIZATION_HEADER, org.id)
      .send({ role: 'VIEWER' });
    expect(self.status).toBe(403);

    const ownerMembership = await OrganizationMemberModel.findOne({ organizationId: org.id, role: 'ORGANIZATION_OWNER' }).lean();
    const removeOwner = await admin.agent
      .delete(`/api/v1/organization-members/${ownerMembership!._id}`)
      .set(ORGANIZATION_HEADER, org.id);
    expect(removeOwner.status).toBe(403);

    const audit = await AuditLogModel.findOne({ organizationId: org.id, action: 'member.role_update' }).lean();
    expect(audit?.metadata).toMatchObject({ previousRole: 'VIEWER', newRole: 'MARKETING_MANAGER' });
  });

  it('always keeps at least one owner', async () => {
    const owner = await registerUser(app);
    const coOwner = await registerUser(app);
    const org = await createOrganization(owner);
    const coOwnerId = await addMember(owner, org.id, coOwner, 'ORGANIZATION_OWNER');

    // With two owners, one may demote the other...
    const demote = await owner.agent
      .patch(`/api/v1/organization-members/${coOwnerId}`)
      .set(ORGANIZATION_HEADER, org.id)
      .send({ role: 'ADMIN' });
    expect(demote.status).toBe(200);

    // ...but the remaining sole owner cannot be removed by anyone (and not by themselves).
    const ownerMembership = await OrganizationMemberModel.findOne({ organizationId: org.id, userId: owner.user.id }).lean();
    const self = await owner.agent
      .delete(`/api/v1/organization-members/${ownerMembership!._id}`)
      .set(ORGANIZATION_HEADER, org.id);
    expect(self.status).toBe(403);
  });

  it('platform super admins can access any organization, and the access is audited', async () => {
    const owner = await registerUser(app);
    const support = await registerUser(app, 'Support Engineer');
    const org = await createOrganization(owner);
    await UserModel.updateOne({ _id: support.user.id }, { $set: { platformRole: 'SUPER_ADMIN' } });

    const res = await support.agent.get('/api/v1/organization-members').set(ORGANIZATION_HEADER, org.id);
    expect(res.status).toBe(200);
    const audit = await AuditLogModel.findOne({ organizationId: org.id, action: 'organization.support_access' }).lean();
    expect(audit?.actorUserId?.toString()).toBe(support.user.id);
  });

  it('unauthenticated requests are rejected before tenant resolution', async () => {
    const owner = await registerUser(app);
    const org = await createOrganization(owner);
    const res = await request(app).get('/api/v1/organization-members').set(ORGANIZATION_HEADER, org.id);
    expect(res.status).toBe(401);
  });
});
