import { model, Schema, type Types } from 'mongoose';
import {
  AD_ACCOUNT_STATUSES,
  INTEGRATION_PROVIDERS,
  type AdAccountStatus,
  type IntegrationProvider,
} from '@mp/shared';
import { createSchema } from '../../lib/mongoose/base-schema';
import { tenantGuardPlugin } from '../../lib/mongoose/tenant-guard.plugin';

/**
 * An advertising account (Google Ads customer, Meta ad account) discovered through an
 * Integration. Populated by the sync jobs of the integrations milestone; read-only in M1.
 * Accounts that disappear upstream are archived (archivedAt), not deleted.
 */
export interface AdAccount {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  integrationId: Types.ObjectId;
  provider: IntegrationProvider;
  externalId: string;
  name: string;
  currency: string | null;
  timezone: string | null;
  status: AdAccountStatus;
  lastSyncedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const adAccountSchema = createSchema<AdAccount>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  integrationId: { type: Schema.Types.ObjectId, ref: 'Integration', required: true },
  provider: { type: String, enum: INTEGRATION_PROVIDERS, required: true },
  externalId: { type: String, required: true, maxlength: 128 },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  currency: { type: String, default: null, maxlength: 3 },
  timezone: { type: String, default: null },
  status: { type: String, enum: AD_ACCOUNT_STATUSES, default: 'UNKNOWN', required: true },
  lastSyncedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
});

adAccountSchema.plugin(tenantGuardPlugin);
adAccountSchema.index({ organizationId: 1, provider: 1, externalId: 1 }, { unique: true });
adAccountSchema.index({ organizationId: 1, integrationId: 1, archivedAt: 1 });

export const AdAccountModel = model<AdAccount>('AdAccount', adAccountSchema);
