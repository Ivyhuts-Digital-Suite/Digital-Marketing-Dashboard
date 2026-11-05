export const INTEGRATION_PROVIDERS = ['GOOGLE_ADS', 'META_ADS'] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

/**
 * Lifecycle of a stored integration connection.
 * PENDING -> ACTIVE <-> ERROR / EXPIRED -> DISCONNECTED (terminal, kept for audit history).
 */
export const INTEGRATION_STATUSES = ['PENDING', 'ACTIVE', 'ERROR', 'EXPIRED', 'DISCONNECTED'] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

/**
 * Availability of a provider for an organization, as shown in the catalog:
 * - NOT_CONFIGURED: the server has no platform credentials for the provider.
 * - COMING_SOON: credentials exist, but the connection flow ships in a later milestone.
 * - AVAILABLE: the organization can start a connection.
 */
export const PROVIDER_AVAILABILITY = ['NOT_CONFIGURED', 'COMING_SOON', 'AVAILABLE'] as const;
export type ProviderAvailability = (typeof PROVIDER_AVAILABILITY)[number];

export const AD_ACCOUNT_STATUSES = ['ACTIVE', 'PAUSED', 'DISABLED', 'UNKNOWN'] as const;
export type AdAccountStatus = (typeof AD_ACCOUNT_STATUSES)[number];

export const INTEGRATION_PROVIDER_INFO: Record<
  IntegrationProvider,
  { name: string; description: string; channels: string[] }
> = {
  GOOGLE_ADS: {
    name: 'Google Ads',
    description: 'Search, Display, YouTube and Performance Max campaigns.',
    channels: ['Search', 'Display', 'YouTube', 'Performance Max'],
  },
  META_ADS: {
    name: 'Meta Ads',
    description: 'Facebook and Instagram advertising accounts.',
    channels: ['Facebook', 'Instagram'],
  },
};
