import { model, Schema, type Types } from 'mongoose';
import { AUDIT_RESOURCE_TYPES, type AuditAction, type AuditResourceType } from '@mp/shared';
import { createSchema } from '../../lib/mongoose/base-schema';
import { appendOnlyPlugin } from '../../lib/mongoose/append-only.plugin';
import { tenantGuardPlugin } from '../../lib/mongoose/tenant-guard.plugin';

/**
 * Append-only audit trail. `organizationId` is null for user-level events (sign-in,
 * profile changes). `actorType` distinguishes human, system and (future) AI-agent actions.
 */
export const AUDIT_ACTOR_TYPES = ['user', 'system', 'ai_agent'] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export interface AuditLog {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId | null;
  actorType: AuditActorType;
  actorUserId: Types.ObjectId | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = createSchema<AuditLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    actorType: { type: String, enum: AUDIT_ACTOR_TYPES, required: true, default: 'user' },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, maxlength: 64 },
    resourceType: { type: String, enum: AUDIT_RESOURCE_TYPES, required: true },
    resourceId: { type: String, default: null, maxlength: 64 },
    ipAddress: { type: String, default: null, maxlength: 64 },
    userAgent: { type: String, default: null, maxlength: 512 },
    requestId: { type: String, default: null, maxlength: 64 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

auditLogSchema.plugin(tenantGuardPlugin);
auditLogSchema.plugin(appendOnlyPlugin);
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });

export const AuditLogModel = model<AuditLog>('AuditLog', auditLogSchema);
