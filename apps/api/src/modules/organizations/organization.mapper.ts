import type { OrganizationRole, Permission } from '@mp/shared';
import type { OrganizationDto, OrganizationWithMembershipDto } from '@mp/types';
import type { Organization } from './organization.model';

export function toOrganizationDto(org: Organization): OrganizationDto {
  return {
    id: String(org._id),
    name: org.name,
    slug: org.slug,
    status: org.status,
    timezone: org.timezone,
    currency: org.currency,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export function toOrganizationWithMembershipDto(
  org: Organization,
  membership: { id: string; role: OrganizationRole; permissions: readonly Permission[] },
): OrganizationWithMembershipDto {
  return {
    ...toOrganizationDto(org),
    membership: { id: membership.id, role: membership.role, permissions: [...membership.permissions] },
  };
}
