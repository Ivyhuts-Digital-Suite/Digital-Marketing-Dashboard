import type { Request } from 'express';
import type { Types } from 'mongoose';
import type { AuditAction, AuditResourceType } from '@mp/shared';
import type { AuditLogDto } from '@mp/types';
import type { ListAuditLogsQuery } from '@mp/validators';
import type { Logger } from '../../lib/logger';
import { clientIp } from '../../lib/http';
import { redactSensitive } from '../../lib/redact';
import { TenantRepository, type TenantScope } from '../../lib/mongoose/tenant-repository';
import { AuditLogModel, type AuditActorType, type AuditLog } from './audit-log.model';

export interface AuditEntry {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | Types.ObjectId | null;
  organizationId?: Types.ObjectId | null;
  actorUserId?: Types.ObjectId | null;
  actorType?: AuditActorType;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface AuditRecordOptions {
  /**
   * When true, a failure to write the audit record is rethrown so the calling operation
   * fails too. Use for high-stakes actions (budget changes, AI-executed operations).
   */
  critical?: boolean;
}

interface PopulatedActor {
  _id: Types.ObjectId;
  name: string;
  email: string;
}

type AuditLogWithActor = Omit<AuditLog, 'actorUserId'> & { actorUserId: PopulatedActor | Types.ObjectId | null };

class AuditLogRepository extends TenantRepository<AuditLog & { organizationId: Types.ObjectId }> {}

export class AuditService {
  private readonly repository = new AuditLogRepository(
    AuditLogModel as unknown as ConstructorParameters<typeof AuditLogRepository>[0],
  );

  constructor(private readonly logger: Logger) {}

  /** Appends an audit record. Metadata is redacted; secrets must never reach the audit trail. */
  async record(entry: AuditEntry, options: AuditRecordOptions = {}): Promise<void> {
    try {
      await AuditLogModel.create({
        organizationId: entry.organizationId ?? null,
        actorType: entry.actorType ?? (entry.actorUserId ? 'user' : 'system'),
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ? String(entry.resourceId) : null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent?.slice(0, 512) ?? null,
        requestId: entry.requestId ?? null,
        metadata: redactSensitive(entry.metadata ?? {}),
      });
    } catch (error) {
      this.logger.error({ err: error, action: entry.action }, 'Failed to write audit log');
      if (options.critical) throw error;
    }
  }

  /** Records an entry enriched with the request's actor, tenant, IP, user agent and request ID. */
  recordFromRequest(req: Request, entry: AuditEntry, options?: AuditRecordOptions): Promise<void> {
    return this.record(
      {
        actorUserId: req.auth?.userId ?? null,
        organizationId: req.tenant?.organizationId ?? null,
        ipAddress: clientIp(req),
        userAgent: req.get('user-agent') ?? null,
        requestId: String(req.id),
        ...entry,
      },
      options,
    );
  }

  async list(scope: TenantScope, query: ListAuditLogsQuery): Promise<{ items: AuditLogDto[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (query.action) filter.action = query.action;
    if (query.resourceType) filter.resourceType = query.resourceType;
    if (query.since) filter.createdAt = { $gte: new Date(query.since) };

    const [docs, total] = await Promise.all([
      this.repository
        .find(scope, filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate('actorUserId', 'name email')
        .lean<AuditLogWithActor[]>(),
      this.repository.count(scope, filter),
    ]);

    return { items: docs.map(toAuditLogDto), total };
  }
}

function isPopulatedActor(value: AuditLogWithActor['actorUserId']): value is PopulatedActor {
  return Boolean(value && typeof value === 'object' && 'email' in value);
}

export function toAuditLogDto(doc: AuditLogWithActor): AuditLogDto {
  const actor = doc.actorUserId;
  return {
    id: String(doc._id),
    organizationId: doc.organizationId ? String(doc.organizationId) : null,
    actor: isPopulatedActor(actor) ? { id: String(actor._id), name: actor.name, email: actor.email } : null,
    action: doc.action,
    resourceType: doc.resourceType,
    resourceId: doc.resourceId,
    ipAddress: doc.ipAddress,
    metadata: doc.metadata ?? {},
    createdAt: doc.createdAt.toISOString(),
  };
}
