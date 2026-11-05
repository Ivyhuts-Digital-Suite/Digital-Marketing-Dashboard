import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import { checkDatabase, connectDatabase, disconnectDatabase, isDatabaseConnected } from '../src/lib/database';
import { createLogger } from '../src/lib/logger';
import { AppendOnlyError } from '../src/lib/mongoose/append-only.plugin';
import { TenantGuardError } from '../src/lib/mongoose/tenant-guard.plugin';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuditLogModel } from '../src/modules/audit/audit-log.model';
import { IntegrationModel } from '../src/modules/integrations/integration.model';
import { OrganizationMemberModel } from '../src/modules/members/member.model';
import { UserModel } from '../src/modules/users/user.model';
import '../src/models';

const logger = createLogger({ level: 'silent' });

describe('database connection lifecycle', () => {
  it('connects, reports health, and disconnects cleanly', async () => {
    await connectDatabase({ uri: inject('mongoUri'), dbName: `test_conn_${randomUUID().slice(0, 8)}`, autoIndex: true, logger });
    expect(isDatabaseConnected()).toBe(true);
    const health = await checkDatabase();
    expect(health.status).toBe('up');
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);

    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
    expect(isDatabaseConnected()).toBe(false);
    expect((await checkDatabase()).status).toBe('down');
  });

  it('fails fast when the server is unreachable', async () => {
    await expect(
      connectDatabase({ uri: 'mongodb://127.0.0.1:1/unreachable', autoIndex: false, logger, serverSelectionTimeoutMS: 500 }),
    ).rejects.toThrow();
    await disconnectDatabase();
  });
});

describe('model conventions', () => {
  beforeAll(async () => {
    await mongoose.connect(inject('mongoUri'), { dbName: `test_models_${randomUUID().slice(0, 8)}` });
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).createIndexes()));
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('hides password hashes from default queries and JSON', async () => {
    const user = await UserModel.create({ email: 'hidden@example.test', name: 'Hidden', passwordHash: 'argon-hash' });
    expect(JSON.stringify(user.toJSON())).not.toContain('argon-hash');
    expect(user.toJSON()).toHaveProperty('id');
    const fetched = await UserModel.findById(user._id).lean();
    expect(fetched).not.toHaveProperty('passwordHash');
  });

  it('enforces unique email addresses at the database level', async () => {
    await UserModel.create({ email: 'unique@example.test', name: 'One', passwordHash: 'x' });
    await expect(UserModel.create({ email: 'UNIQUE@example.test', name: 'Two', passwordHash: 'x' })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('declares compound tenant indexes', async () => {
    const indexes = await OrganizationMemberModel.collection.indexes();
    expect(indexes.some((i) => JSON.stringify(i.key) === JSON.stringify({ organizationId: 1, userId: 1 }) && i.unique)).toBe(true);
  });

  describe('tenant guard', () => {
    it('rejects tenant-model queries without an organizationId filter', async () => {
      await expect(IntegrationModel.find({ provider: 'GOOGLE_ADS' })).rejects.toBeInstanceOf(TenantGuardError);
      await expect(IntegrationModel.countDocuments({})).rejects.toBeInstanceOf(TenantGuardError);
      await expect(IntegrationModel.updateMany({}, { $set: { status: 'ERROR' } })).rejects.toBeInstanceOf(TenantGuardError);
      await expect(IntegrationModel.deleteMany({})).rejects.toBeInstanceOf(TenantGuardError);
      await expect(IntegrationModel.aggregate([{ $match: { provider: 'META_ADS' } }])).rejects.toBeInstanceOf(TenantGuardError);
    });

    it('allows scoped queries and explicit, opt-in cross-tenant queries', async () => {
      const organizationId = new Types.ObjectId();
      await IntegrationModel.create({ organizationId, provider: 'GOOGLE_ADS', displayName: 'Scoped' });
      expect(await IntegrationModel.countDocuments({ organizationId })).toBe(1);
      expect(await IntegrationModel.aggregate([{ $match: { organizationId } }])).toHaveLength(1);
      expect(await IntegrationModel.countDocuments({}).setOptions({ skipTenantGuard: true })).toBeGreaterThanOrEqual(1);
    });
  });

  describe('audit log', () => {
    const audit = new AuditService(logger);

    it('creates entries with redacted metadata', async () => {
      const organizationId = new Types.ObjectId();
      await audit.record({
        action: 'organization.update',
        resourceType: 'Organization',
        resourceId: organizationId,
        organizationId,
        actorUserId: new Types.ObjectId(),
        metadata: { name: 'ok', password: 'hunter2', nested: { accessToken: 'abc', keep: 1 } },
      });
      const entry = await AuditLogModel.findOne({ organizationId }).lean();
      expect(entry?.metadata).toEqual({ name: 'ok', password: '[REDACTED]', nested: { accessToken: '[REDACTED]', keep: 1 } });
      expect(entry?.createdAt).toBeInstanceOf(Date);
    });

    it('is append-only: updates and deletes are refused', async () => {
      const organizationId = new Types.ObjectId();
      await audit.record({ action: 'organization.create', resourceType: 'Organization', organizationId });
      const entry = await AuditLogModel.findOne({ organizationId });

      await expect(AuditLogModel.updateOne({ organizationId }, { $set: { action: 'x' } })).rejects.toBeInstanceOf(AppendOnlyError);
      await expect(AuditLogModel.deleteMany({ organizationId })).rejects.toBeInstanceOf(AppendOnlyError);
      await expect(AuditLogModel.findOneAndDelete({ organizationId })).rejects.toBeInstanceOf(AppendOnlyError);
      await expect(entry!.deleteOne()).rejects.toBeInstanceOf(AppendOnlyError);
      entry!.action = 'organization.archive';
      await expect(entry!.save()).rejects.toBeInstanceOf(AppendOnlyError);

      expect(await AuditLogModel.countDocuments({ organizationId })).toBe(1);
    });

    it('rethrows write failures only for critical entries', async () => {
      const invalid = { action: 'organization.create', resourceType: 'NotAType' } as never;
      await expect(audit.record(invalid)).resolves.toBeUndefined();
      await expect(audit.record(invalid, { critical: true })).rejects.toThrow();
    });
  });
});
