import type {
  AdAccountStatus,
  AuditAction,
  AuditResourceType,
  IntegrationProvider,
  IntegrationStatus,
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
  OrganizationStatus,
  Permission,
  PlatformRole,
  ProviderAvailability,
  UserStatus,
} from '@mp/shared';

/** ISO-8601 timestamp string as serialized by the API. */
export type IsoDate = string;

export interface UserDto {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  platformRole: PlatformRole;
  emailVerified: boolean;
  lastLoginAt: IsoDate | null;
  createdAt: IsoDate;
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  timezone: string;
  currency: string;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

/** Organization as seen by the current user, including their role in it. */
export interface OrganizationWithMembershipDto extends OrganizationDto {
  membership: {
    id: string;
    role: OrganizationRole;
    permissions: Permission[];
  };
}

export interface OrganizationMemberDto {
  id: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  joinedAt: IsoDate;
  user: Pick<UserDto, 'id' | 'email' | 'name'>;
}

export interface InvitationDto {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  status: InvitationStatus;
  expiresAt: IsoDate;
  invitedBy: { id: string; name: string } | null;
  createdAt: IsoDate;
}

/** Returned once when an invitation is created. The token is never retrievable again. */
export interface CreatedInvitationDto {
  invitation: InvitationDto;
  delivery: 'email_queued' | 'email_sent' | 'manual';
  /** Present only for manual delivery (SMTP not configured), for the inviter to share. */
  acceptUrl?: string;
}

export interface IntegrationDto {
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  displayName: string;
  externalAccountId: string | null;
  scopes: string[];
  lastSyncedAt: IsoDate | null;
  connectedAt: IsoDate | null;
  createdAt: IsoDate;
}

export interface IntegrationCatalogEntryDto {
  provider: IntegrationProvider;
  name: string;
  description: string;
  channels: string[];
  availability: ProviderAvailability;
  connections: IntegrationDto[];
}

export interface AdAccountDto {
  id: string;
  organizationId: string;
  integrationId: string;
  provider: IntegrationProvider;
  externalId: string;
  name: string;
  currency: string | null;
  timezone: string | null;
  status: AdAccountStatus;
  createdAt: IsoDate;
}

export interface AuditLogDto {
  id: string;
  organizationId: string | null;
  actor: { id: string; name: string; email: string } | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  createdAt: IsoDate;
}

export interface SessionDto {
  user: UserDto;
  organizations: OrganizationWithMembershipDto[];
}
