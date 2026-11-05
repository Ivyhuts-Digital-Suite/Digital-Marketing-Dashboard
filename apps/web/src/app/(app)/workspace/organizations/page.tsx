'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Plus } from 'lucide-react';
import { Suspense, useState } from 'react';
import { ROLE_LABELS } from '@mp/shared';
import { useWorkspace } from '@/lib/session';
import { CreateOrganizationForm } from '@/features/organizations/create-organization-form';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Badge, Card } from '@/components/ui/primitives';

function OrganizationsView() {
  const router = useRouter();
  const params = useSearchParams();
  const { session, organization: active, setActiveOrganization } = useWorkspace();
  const [creating, setCreating] = useState(params.get('create') === '1');

  return (
    <PageContainer>
      <PageHeader
        title="Organizations"
        description="Each organization is an isolated workspace with its own team, integrations and data."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            New organization
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {session.organizations.map((org) => {
          const isActive = org.id === active.id;
          return (
            <Card key={org.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-sm font-semibold text-foreground">
                  {org.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{org.name}</p>
                  <p className="truncate text-xs text-muted">{org.slug}</p>
                </div>
                {isActive && (
                  <Badge tone="primary">
                    <Check className="size-3" aria-hidden />
                    Active
                  </Badge>
                )}
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-subtle">Your role</dt>
                  <dd className="mt-0.5 text-foreground">{ROLE_LABELS[org.membership.role]}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Currency</dt>
                  <dd className="mt-0.5 text-foreground">{org.currency}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-subtle">Timezone</dt>
                  <dd className="mt-0.5 truncate text-foreground">{org.timezone}</dd>
                </div>
              </dl>
              <div className="mt-5 flex-1" />
              <Button
                variant="secondary"
                size="sm"
                disabled={isActive}
                onClick={() => {
                  setActiveOrganization(org.id);
                  router.push('/dashboard');
                }}
              >
                {isActive ? 'Current organization' : 'Switch to this organization'}
              </Button>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Create organization"
        description="You will be the owner of the new organization."
      >
        <CreateOrganizationForm
          onCreated={(organization) => {
            setCreating(false);
            setActiveOrganization(organization.id);
            router.push('/dashboard');
          }}
        />
      </Dialog>
    </PageContainer>
  );
}

export default function OrganizationsPage() {
  return (
    <Suspense>
      <OrganizationsView />
    </Suspense>
  );
}
