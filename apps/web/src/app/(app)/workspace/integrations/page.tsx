'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plug, Search, Share2, TriangleAlert } from 'lucide-react';
import type { IntegrationProvider, ProviderAvailability } from '@mp/shared';
import type { IntegrationCatalogEntryDto } from '@mp/types';
import { apiRequest } from '@/lib/api-client';
import { orgKey, useWorkspace } from '@/lib/session';
import { useIntegrationCatalog } from '@/features/workspace/queries';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, type BadgeTone } from '@/components/ui/primitives';
import { ErrorState, LoadingState } from '@/components/ui/states';

const PROVIDER_ICONS: Record<IntegrationProvider, typeof Search> = { GOOGLE_ADS: Search, META_ADS: Share2 };

const AVAILABILITY: Record<ProviderAvailability, { label: string; tone: BadgeTone; help: string }> = {
  NOT_CONFIGURED: {
    label: 'Not configured',
    tone: 'neutral',
    help: 'The platform administrator has not configured API credentials for this provider on the server.',
  },
  COMING_SOON: {
    label: 'Coming soon',
    tone: 'warning',
    help: 'Server credentials are configured. The secure connection flow ships in the integrations milestone.',
  },
  AVAILABLE: { label: 'Available', tone: 'success', help: 'Connect an account to start syncing data.' },
};

const STATUS_TONE: Record<string, BadgeTone> = { ACTIVE: 'success', PENDING: 'warning', ERROR: 'danger', EXPIRED: 'danger' };

function ProviderCard({ entry }: { entry: IntegrationCatalogEntryDto }) {
  const { organization, can } = useWorkspace();
  const queryClient = useQueryClient();
  const Icon = PROVIDER_ICONS[entry.provider];
  const availability = AVAILABILITY[entry.availability];
  const disconnect = useMutation({
    mutationFn: (id: string) => apiRequest(`/integrations/${id}`, { method: 'DELETE', organizationId: organization.id }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: orgKey(organization.id, 'integrations') }),
  });

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-4 p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-muted">
          <Icon className="size-5 text-foreground" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-foreground">{entry.name}</h2>
            {entry.connections.length > 0 ? (
              <Badge tone="success">{entry.connections.length} connected</Badge>
            ) : (
              <Badge tone={availability.tone}>{availability.label}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">{entry.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {entry.channels.map((channel) => (
              <Badge key={channel}>{channel}</Badge>
            ))}
          </div>
        </div>
      </div>

      {entry.connections.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {entry.connections.map((connection) => (
            <li key={connection.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{connection.displayName}</p>
                <p className="text-xs text-muted">
                  {connection.externalAccountId ?? 'No account ID'} ·{' '}
                  {connection.lastSyncedAt ? `synced ${new Date(connection.lastSyncedAt).toLocaleString()}` : 'never synced'}
                </p>
              </div>
              <Badge tone={STATUS_TONE[connection.status] ?? 'neutral'}>{connection.status.toLowerCase()}</Badge>
              {can('integrations:manage') && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={disconnect.isPending && disconnect.variables === connection.id}
                  onClick={() => {
                    if (window.confirm(`Disconnect ${connection.displayName}?`)) disconnect.mutate(connection.id);
                  }}
                >
                  Disconnect
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center gap-3 border-t border-border bg-surface-muted px-5 py-3">
        {entry.availability === 'NOT_CONFIGURED' ? (
          <TriangleAlert className="size-4 shrink-0 text-subtle" aria-hidden />
        ) : (
          <Clock className="size-4 shrink-0 text-subtle" aria-hidden />
        )}
        <p className="flex-1 text-xs text-muted">{availability.help}</p>
        <Button size="sm" disabled title="Connection flows are not available yet">
          Connect
        </Button>
      </div>
    </Card>
  );
}

export default function IntegrationsPage() {
  const catalog = useIntegrationCatalog();

  return (
    <PageContainer>
      <PageHeader
        title="Integrations"
        description="Connect advertising platforms to sync accounts, campaigns and performance data."
      />
      <Alert tone="info" className="mb-6" title="No advertising data is connected yet">
        Account connections arrive in the integrations milestone. Until then, nothing in this workspace is populated from
        Google Ads or Meta Ads.
      </Alert>
      {catalog.isPending ? (
        <LoadingState />
      ) : catalog.error ? (
        <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {catalog.data.map((entry) => (
            <ProviderCard key={entry.provider} entry={entry} />
          ))}
        </div>
      )}
      <p className="mt-6 flex items-center gap-2 text-xs text-muted">
        <Plug className="size-3.5" aria-hidden />
        Only members with integration management permission can connect or disconnect accounts.
      </p>
    </PageContainer>
  );
}
