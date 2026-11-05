'use client';

import { useQuery } from '@tanstack/react-query';
import type { AuditLogDto, IntegrationCatalogEntryDto, InvitationDto, OrganizationMemberDto, PaginationMeta } from '@mp/types';
import { apiRequest, apiRequestWithMeta } from '@/lib/api-client';
import { orgKey, useWorkspace } from '@/lib/session';

export function useMembers() {
  const { organization, can } = useWorkspace();
  return useQuery({
    queryKey: orgKey(organization.id, 'members'),
    queryFn: () => apiRequest<{ members: OrganizationMemberDto[] }>('/organization-members', { organizationId: organization.id }),
    select: (data) => data.members,
    enabled: can('members:read'),
  });
}

export function useInvitations() {
  const { organization, can } = useWorkspace();
  return useQuery({
    queryKey: orgKey(organization.id, 'invitations'),
    queryFn: () =>
      apiRequest<{ invitations: InvitationDto[] }>('/organization-members/invitations', { organizationId: organization.id }),
    select: (data) => data.invitations,
    enabled: can('members:invite'),
  });
}

export function useIntegrationCatalog() {
  const { organization, can } = useWorkspace();
  return useQuery({
    queryKey: orgKey(organization.id, 'integrations'),
    queryFn: () => apiRequest<{ providers: IntegrationCatalogEntryDto[] }>('/integrations', { organizationId: organization.id }),
    select: (data) => data.providers,
    enabled: can('integrations:read'),
  });
}

export function useAuditLogs(params: { page?: number; limit?: number; since?: string } = {}) {
  const { organization, can } = useWorkspace();
  const search = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return useQuery({
    queryKey: orgKey(organization.id, 'audit-logs', params),
    queryFn: async () => {
      const { data, meta } = await apiRequestWithMeta<{ auditLogs: AuditLogDto[] }>(`/audit-logs${search ? `?${search}` : ''}`, {
        organizationId: organization.id,
      });
      return { items: data.auditLogs, pagination: meta?.pagination as PaginationMeta };
    },
    enabled: can('audit:read'),
  });
}
