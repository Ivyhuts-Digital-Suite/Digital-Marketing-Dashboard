import type { Request } from 'express';
import {
  AUDIT_ACTIONS,
  INTEGRATION_PROVIDER_INFO,
  INTEGRATION_PROVIDERS,
  type IntegrationProvider,
  type ProviderAvailability,
} from '@mp/shared';
import type { AdAccountDto, IntegrationCatalogEntryDto, IntegrationDto } from '@mp/types';
import type { AppContext } from '../../app-context';
import { Errors } from '../../lib/errors';
import { TenantRepository } from '../../lib/mongoose/tenant-repository';
import type { AuthContext } from '../../middleware/authenticate';
import type { TenantContext } from '../../middleware/organization-context';
import { AdAccountModel, type AdAccount } from './ad-account.model';
import { IntegrationModel, type Integration } from './integration.model';

class IntegrationRepository extends TenantRepository<Integration> {
  constructor() {
    super(IntegrationModel);
  }
}

class AdAccountRepository extends TenantRepository<AdAccount> {
  constructor() {
    super(AdAccountModel);
  }
}

export function toIntegrationDto(doc: Integration): IntegrationDto {
  return {
    id: String(doc._id),
    organizationId: String(doc.organizationId),
    provider: doc.provider,
    status: doc.status,
    displayName: doc.displayName,
    externalAccountId: doc.externalAccountId,
    scopes: doc.scopes,
    lastSyncedAt: doc.lastSyncedAt?.toISOString() ?? null,
    connectedAt: doc.connectedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toAdAccountDto(doc: AdAccount): AdAccountDto {
  return {
    id: String(doc._id),
    organizationId: String(doc.organizationId),
    integrationId: String(doc.integrationId),
    provider: doc.provider,
    externalId: doc.externalId,
    name: doc.name,
    currency: doc.currency,
    timezone: doc.timezone,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };
}

/**
 * Integration registry for an organization. In this milestone the catalog reports real
 * availability and stored connections; the OAuth connection flows (and therefore any
 * contact with Google or Meta) arrive in the integrations milestone.
 */
export class IntegrationService {
  private readonly integrations = new IntegrationRepository();
  private readonly adAccounts = new AdAccountRepository();

  constructor(private readonly ctx: AppContext) {}

  availability(provider: IntegrationProvider): ProviderAvailability {
    const configured =
      provider === 'GOOGLE_ADS'
        ? this.ctx.config.integrations.googleAds.configured
        : this.ctx.config.integrations.meta.configured;
    // Even with platform credentials, connecting is not offered until the OAuth flow ships.
    return configured ? 'COMING_SOON' : 'NOT_CONFIGURED';
  }

  async catalog(tenant: TenantContext): Promise<IntegrationCatalogEntryDto[]> {
    const connections = await this.integrations
      .find(tenant, { status: { $ne: 'DISCONNECTED' } })
      .sort({ createdAt: -1 })
      .lean();

    return INTEGRATION_PROVIDERS.map((provider) => ({
      provider,
      ...INTEGRATION_PROVIDER_INFO[provider],
      availability: this.availability(provider),
      connections: connections.filter((c) => c.provider === provider).map(toIntegrationDto),
    }));
  }

  async get(tenant: TenantContext, integrationId: string): Promise<IntegrationDto> {
    const doc = await this.integrations.findById(tenant, integrationId).lean();
    if (!doc) throw Errors.notFound('Integration');
    return toIntegrationDto(doc);
  }

  async listAdAccounts(tenant: TenantContext, integrationId: string): Promise<AdAccountDto[]> {
    const integration = await this.integrations.findById(tenant, integrationId).lean();
    if (!integration) throw Errors.notFound('Integration');
    const docs = await this.adAccounts
      .find(tenant, { integrationId: integration._id, archivedAt: null })
      .sort({ name: 1 })
      .lean();
    return docs.map(toAdAccountDto);
  }

  connect(provider: IntegrationProvider): never {
    const name = INTEGRATION_PROVIDER_INFO[provider].name;
    if (this.availability(provider) === 'NOT_CONFIGURED') {
      throw Errors.notImplemented(`${name} is not configured on this server.`);
    }
    throw Errors.notImplemented(`${name} connections are not available yet. They ship in the integrations milestone.`);
  }

  async disconnect(req: Request, tenant: TenantContext, actor: AuthContext, integrationId: string): Promise<IntegrationDto> {
    const existing = await this.integrations.findById(tenant, integrationId).lean();
    if (!existing) throw Errors.notFound('Integration');
    if (existing.status === 'DISCONNECTED') return toIntegrationDto(existing);

    const updated = await this.integrations
      .updateById(tenant, integrationId, {
        $set: { status: 'DISCONNECTED', disconnectedAt: new Date(), disconnectedBy: actor.userId },
      })
      .lean();
    if (!updated) throw Errors.notFound('Integration');

    await this.ctx.audit.recordFromRequest(req, {
      action: AUDIT_ACTIONS.INTEGRATION_DISCONNECT,
      resourceType: 'Integration',
      resourceId: integrationId,
      metadata: { provider: existing.provider, previousStatus: existing.status },
    });
    return toIntegrationDto(updated);
  }
}
