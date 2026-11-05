# Role-based access control

Authorization is **permission-based**. Code checks permissions (`requirePermission(PERMISSIONS.MEMBERS_INVITE)`)
and never compares role names. Roles are bundles of permissions defined in one place:
`packages/shared/src/rbac/role-permissions.ts`. The same module powers UI decisions on the
web, but the API enforces every check independently.

## Roles

| Role | Scope | Rank | Summary |
|---|---|---|---|
| `SUPER_ADMIN` | Platform (`User.platformRole`) | – | Support access to any organization (audited). Not assignable via the API. |
| `ORGANIZATION_OWNER` | Organization | 100 | Everything, including archiving the organization and appointing co-owners |
| `ADMIN` | Organization | 80 | Everything except archiving the organization |
| `MARKETING_MANAGER` | Organization | 60 | Integrations, campaign edits/budgets/pause, AI incl. execution, reports |
| `SALES_MANAGER` | Organization | 60 | Leads + CRM management, AI analysis, reports |
| `MARKETING_ANALYST` | Organization | 40 | Read campaigns/leads, AI analysis, reports |
| `SALES_REPRESENTATIVE` | Organization | 40 | Leads + CRM management, read reports |
| `VIEWER` | Organization | 10 | Read-only |

## Permission matrix

O = Owner, A = Admin, MM = Marketing Manager, MA = Marketing Analyst, SM = Sales Manager,
SR = Sales Representative, V = Viewer.

| Permission | O | A | MM | MA | SM | SR | V |
|---|---|---|---|---|---|---|---|
| `organization:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `organization:update` | ✓ | ✓ | | | | | |
| `organization:archive` | ✓ | | | | | | |
| `members:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `members:invite` | ✓ | ✓ | | | | | |
| `members:update_role` | ✓ | ✓ | | | | | |
| `members:remove` | ✓ | ✓ | | | | | |
| `integrations:read` | ✓ | ✓ | ✓ | ✓ | | | ✓ |
| `integrations:manage` | ✓ | ✓ | ✓ | | | | |
| `campaigns:read` | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| `campaigns:update` | ✓ | ✓ | ✓ | | | | |
| `campaigns:budget_update` | ✓ | ✓ | ✓ | | | | |
| `campaigns:pause_resume` | ✓ | ✓ | ✓ | | | | |
| `campaigns:create` | *reserved — granted to no role* | | | | | | |
| `leads:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `leads:manage` | ✓ | ✓ | | | ✓ | ✓ | |
| `crm:read` | ✓ | ✓ | | | ✓ | ✓ | ✓ |
| `crm:manage` | ✓ | ✓ | | | ✓ | ✓ | |
| `ai:analyze` | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| `ai:recommendations_read` | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| `ai:execute` | ✓ | ✓ | ✓ | | | | |
| `reports:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `reports:manage` | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| `audit:read` | ✓ | ✓ | | | | | |

`campaigns:create` exists in the catalog so future campaign creation slots in without a schema
change. It is listed in `RESERVED_PERMISSIONS`, excluded from every role and from super-admin
grants, and no endpoint uses it. Campaign creation is not implemented.

## Role-management rules (enforced in `MemberService`)

- **Assign:** an actor may grant a role only if it ranks strictly below their own; owners may
  grant any role, including co-owner (`canAssignRole`).
- **Manage:** an actor may change or remove a member only if that member ranks strictly below
  them; owners may manage anyone (`canManageMember`).
- **No self-modification:** members cannot change their own role or remove themselves.
- **Last owner:** the last active owner cannot be demoted or removed (`409`).
- Inviting follows the same assignment rule as role changes.

## Adding a permission

1. Add it to `PERMISSIONS` in `packages/shared/src/rbac/permissions.ts`.
2. Grant it to roles in `role-permissions.ts`.
3. Guard routes with `requirePermission(...)`; gate UI with `useWorkspace().can(...)`.
4. Update this matrix and `packages/shared/test/rbac.test.ts`.
