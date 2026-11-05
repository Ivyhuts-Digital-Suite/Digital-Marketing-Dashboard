# Multi-tenancy

**Tenant = Organization.** Every tenant-owned document carries `organizationId`, and every
tenant-owned index starts with it. The backend enforces isolation without relying on the
frontend.

## Layers of enforcement

1. **Tenant context middleware** (`middleware/organization-context.ts` → `requireOrganization`)
   - Reads the organization ID from `X-Organization-Id`, or from `:organizationId` on
     `/organizations/:organizationId` routes. The ID is only a *selector*.
   - Loads the organization (must be `ACTIVE`) and the caller's `ACTIVE` membership.
   - Missing header → `400 ORGANIZATION_REQUIRED`. Malformed, unknown, archived or
     not-a-member IDs all return the same `403 ORGANIZATION_ACCESS_DENIED`, so IDs cannot be probed.
   - Sets `req.tenant = { organizationId, organization, membership, role, permissions, isSupportAccess }`.
     Permissions come from the server-side membership role, never from the client.

2. **Tenant-scoped repositories** (`lib/mongoose/tenant-repository.ts`)
   - `TenantRepository` methods take a `TenantScope` and merge `organizationId` into every
     filter *last*, so a caller-supplied filter cannot override it; `create()` stamps it.
   - Lookups by ID are `{ _id, organizationId }`, so an ID from another tenant yields 404.

3. **Tenant guard plugin** (`lib/mongoose/tenant-guard.plugin.ts`) — defense in depth
   - Applied to `OrganizationMember`, `Invitation`, `Integration`, `AdAccount` and `AuditLog`.
   - Any find/count/update/delete/distinct whose filter lacks `organizationId`, or any
     aggregate whose first `$match` lacks it, throws `TenantGuardError`.
   - Intentional cross-tenant queries must opt out with `.setOptions({ skipTenantGuard: true })`.
     The two in M1 are listing a user's own memberships, and looking up an invitation by its
     one-time token hash. Grep for `skipTenantGuard` in review.

4. **Strict input schemas** reject `organizationId` in request bodies, so a client cannot move a
   record to another tenant.

## Resource ownership rules

- A member's role can be changed or removed only via a membership found inside the active tenant.
- Invitations are accepted by token; the token determines the organization, and the
  invitation email must match the signed-in user's email.
- Ad accounts are listed only after the parent integration is found in the active tenant.

## Platform support access

A `SUPER_ADMIN` (platform role) may open any active organization without a membership. They
receive owner-equivalent grantable permissions, and **every such request is audited** as
`organization.support_access`. This is the only cross-tenant access path for humans.

## Tests

`apps/api/test/tenant-isolation.test.ts` creates Organization A and Organization B and proves
that a user of B:

- is denied (403) on A's members, invitations, integrations and audit logs, and on reading,
  updating or archiving A by path;
- gets 404 when referencing A's integration, ad accounts, members or invitations from within B;
- never sees A's records in B's listings;
- cannot smuggle `organizationId` into a body;
- cannot distinguish unknown or malformed organization IDs from forbidden ones.

`database.test.ts` proves the tenant guard rejects unscoped queries and aggregates.

## Checklist for new tenant-owned collections

1. Include `organizationId: { type: ObjectId, ref: 'Organization', required: true }`.
2. `schema.plugin(tenantGuardPlugin)`.
3. Compound indexes starting with `organizationId`.
4. Access only through a `TenantRepository` subclass.
5. Add cross-tenant tests for each new endpoint.
