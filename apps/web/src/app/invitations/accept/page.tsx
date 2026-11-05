'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { Suspense } from 'react';
import type { OrganizationWithMembershipDto } from '@mp/types';
import { apiRequest } from '@/lib/api-client';
import { rememberActiveOrganization, SESSION_QUERY_KEY, useSessionExpiryRedirect, useSessionQuery } from '@/lib/session';
import { Button, ButtonLink } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/primitives';
import { ErrorState, LoadingState } from '@/components/ui/states';

function AcceptInvitation() {
  useSessionExpiryRedirect();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useSearchParams().get('token') ?? '';
  const session = useSessionQuery();

  const accept = useMutation({
    mutationFn: () =>
      apiRequest<{ organization: OrganizationWithMembershipDto }>('/organization-members/invitations/accept', {
        method: 'POST',
        body: { token },
      }),
    onSuccess: async ({ organization }) => {
      rememberActiveOrganization(organization.id);
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      router.replace('/dashboard');
    },
  });

  if (session.isPending) return <LoadingState className="min-h-dvh" />;
  if (session.error) return <ErrorState error={session.error} onRetry={() => session.refetch()} className="min-h-dvh" />;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-6">
        <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-primary-soft">
          <MailCheck className="size-5 text-primary" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Join an organization</h1>
        <p className="mt-1 text-sm text-muted">
          You are signed in as <span className="font-medium text-foreground">{session.data.user.email}</span>. The
          invitation must have been sent to this address.
        </p>

        {!token && (
          <Alert tone="warning" className="mt-5" title="This link is missing its invitation token.">
            Open the full link from your invitation email.
          </Alert>
        )}
        {accept.error && (
          <Alert tone="danger" className="mt-5" title={accept.error.message}>
            If the invitation expired or was revoked, ask an organization admin to send a new one.
          </Alert>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => accept.mutate()} loading={accept.isPending} disabled={!token}>
            Accept invitation
          </Button>
          <ButtonLink href="/dashboard" variant="secondary">
            Not now
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <AcceptInvitation />
    </Suspense>
  );
}
