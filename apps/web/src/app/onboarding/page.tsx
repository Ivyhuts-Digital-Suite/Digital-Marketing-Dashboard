'use client';

import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { useEffect } from 'react';
import { rememberActiveOrganization, useSessionExpiryRedirect, useSessionQuery } from '@/lib/session';
import { CreateOrganizationForm } from '@/features/organizations/create-organization-form';
import { Card } from '@/components/ui/primitives';
import { ErrorState, LoadingState } from '@/components/ui/states';

export default function OnboardingPage() {
  useSessionExpiryRedirect();
  const router = useRouter();
  const session = useSessionQuery();
  const hasOrganizations = (session.data?.organizations.length ?? 0) > 0;

  useEffect(() => {
    if (hasOrganizations) router.replace('/dashboard');
  }, [hasOrganizations, router]);

  if (session.isPending || hasOrganizations) return <LoadingState className="min-h-dvh" />;
  if (session.error) return <ErrorState error={session.error} onRetry={() => session.refetch()} className="min-h-dvh" />;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex size-11 items-center justify-center rounded-xl bg-primary-soft">
          <Building2 className="size-5 text-primary" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome, {session.data.user.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Create your first organization. Each organization has its own ad accounts, CRM data, team and reports — fully
          isolated from every other organization. Joining an existing one? Use the invitation link you were sent.
        </p>
        <Card className="mt-8 p-6">
          <CreateOrganizationForm
            submitLabel="Create organization and continue"
            onCreated={(organization) => {
              rememberActiveOrganization(organization.id);
              router.replace('/dashboard');
            }}
          />
        </Card>
      </div>
    </div>
  );
}
