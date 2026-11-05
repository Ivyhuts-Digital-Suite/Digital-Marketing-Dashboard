'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { hasPermission, type Permission } from '@mp/shared';
import type { OrganizationWithMembershipDto, SessionDto } from '@mp/types';
import { apiRequest, ApiError, SESSION_EXPIRED_EVENT } from './api-client';

export const SESSION_QUERY_KEY = ['session'] as const;
const ACTIVE_ORG_STORAGE_KEY = 'mp.activeOrganizationId';

export function useSessionQuery() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => apiRequest<SessionDto>('/auth/me'),
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 2,
    staleTime: 60_000,
  });
}

/** Redirects to /login (preserving the destination) when the session expires anywhere in the app. */
export function useSessionExpiryRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  useEffect(() => {
    const onExpired = () => {
      queryClient.clear();
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [pathname, queryClient, router]);
}

interface WorkspaceContextValue {
  session: SessionDto;
  organization: OrganizationWithMembershipDto;
  setActiveOrganization: (organizationId: string) => void;
  /** UI-level permission check. The API enforces permissions independently. */
  can: (permission: Permission) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStoredOrganization(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberActiveOrganization(organizationId: string) {
  try {
    window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, organizationId);
  } catch {
    // Storage may be unavailable (private mode); selection then lasts for this page only.
  }
}

export function WorkspaceProvider({ session, children }: { session: SessionDto; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : readStoredOrganization(),
  );

  const organization =
    session.organizations.find((org) => org.id === selectedId) ?? session.organizations[0]!;

  const setActiveOrganization = useCallback(
    (organizationId: string) => {
      rememberActiveOrganization(organizationId);
      setSelectedId(organizationId);
      // Tenant data is keyed by organization ID; drop other tenants' cached data.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === 'org' && query.queryKey[1] !== organizationId });
    },
    [queryClient],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      session,
      organization,
      setActiveOrganization,
      can: (permission) => hasPermission(organization.membership.permissions, permission),
    }),
    [session, organization, setActiveOrganization],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}

/** Query key for tenant data: always namespaced by organization ID. */
export function orgKey(organizationId: string, ...parts: unknown[]) {
  return ['org', organizationId, ...parts] as const;
}
