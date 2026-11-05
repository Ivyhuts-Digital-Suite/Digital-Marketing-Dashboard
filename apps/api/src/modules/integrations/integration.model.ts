import { model, Schema, type Types } from 'mongoose';
import {
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUSES,
  type IntegrationProvider,
  type IntegrationStatus,
} from '@mp/shared';
import { createSchema } from '../../lib/mongoose/base-schema';
import { tenantGuardPlugin } from '../../lib/mongoose/tenant-guard.plugin';

/**
 * An organization's connection to an advertising platform (one per authorized platform
 * account / manager account).
 *
 * OAuth credentials are deliberately NOT modelled yet: the connection flow ships in the
 * integrations milestone, where tokens will be stored encrypted (envelope encryption)
 * in a dedicated credentials field that is never selected by default.
 */
export interface Integration {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  displayName: string;
  externalAccountId: string | null;
  scopes: string[];
  connectedBy: Types.ObjectId | null;
  connectedAt: Date | null;
  lastSyncedAt: Date | null;
  lastError: { code: string; message: string; occurredAt: Date } | null;
  disconnectedAt: Date | null;
  disconnectedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const integrationSchema = createSchema<Integration>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  provider: { type: String, enum: INTEGRATION_PROVIDERS, required: true },
  status: { type: String, enum: INTEGRATION_STATUSES, default: 'PENDING', required: true },
  displayName: { type: String, required: true, trim: true, maxlength: 200 },
  externalAccountId: { type: String, default: null, maxlength: 128 },
  scopes: { type: [String], default: [] },
  connectedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  connectedAt: { type: Date, default: null },
  lastSyncedAt: { type: Date, default: null },
  lastError: {
    type: new Schema(
      { code: String, message: { type: String, maxlength: 500 }, occurredAt: Date },
      { _id: false },
    ),
    default: null,
  },
  disconnectedAt: { type: Date, default: null },
  disconnectedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});

integrationSchema.plugin(tenantGuardPlugin);
integrationSchema.index({ organizationId: 1, provider: 1, status: 1 });
// One live connection per external platform account per organization.
integrationSchema.index(
  { organizationId: 1, provider: 1, externalAccountId: 1 },
  {
    unique: true,
    name: 'unique_live_external_account',
    partialFilterExpression: {
      externalAccountId: { $type: 'string' },
      status: { $in: ['PENDING', 'ACTIVE', 'ERROR', 'EXPIRED'] },
    },
  },
);

export const IntegrationModel = model<Integration>('Integration', integrationSchema);
