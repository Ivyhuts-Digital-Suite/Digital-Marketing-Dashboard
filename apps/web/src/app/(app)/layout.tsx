'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ApiError } from '@/lib/api-client';
import { useSessionExpiryRedirect, useSessionQuery, WorkspaceProvider } from '@/lib/session';
import { AppShell } from '@/components/shell/app-shell';
import { ErrorState, LoadingState } from '@/components/ui/states';

/**
 * Authenticated application frame. Loads the session (user + organizations), sends users
 * without an organization to onboarding, and provides the active-organization context.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  useSessionExpiryRedirect();
  const router = useRouter();
  const session = useSessionQuery();
  const needsOnboarding = session.data?.organizations.length === 0;
  const unauthenticated = session.error instanceof ApiError && session.error.status === 401;

  useEffect(() => {
    if (needsOnboarding) router.replace('/onboarding');
  }, [needsOnboarding, router]);

  if (session.isPending || needsOnboarding || unauthenticated) {
    return <LoadingState label="Loading your workspace…" className="min-h-dvh" />;
  }
  if (session.error) {
    return <ErrorState error={session.error} onRetry={() => session.refetch()} className="min-h-dvh" />;
  }

  return (
    <WorkspaceProvider session={session.data}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
