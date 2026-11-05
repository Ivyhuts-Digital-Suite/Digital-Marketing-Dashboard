# Database

MongoDB (Atlas in production) via Mongoose 9. Atlas Vector Search compatibility: nothing in M1
precludes it — future embedding collections will add `$vectorSearch` indexes through Atlas.

## Connection lifecycle (`apps/api/src/lib/database.ts`)

- `connectDatabase()` — one shared connection, pool size 20, 10s server-selection timeout,
  `strictQuery` on. Startup fails if MongoDB is unreachable.
- Connection events are logged without the connection string.
- `checkDatabase()` pings the primary (2s timeout) for `/api/v1/health/ready`.
- Graceful shutdown: HTTP server stops accepting → in-flight requests finish → queues, Redis
  and MongoDB close (15s hard timeout).
- `autoIndex` is on outside production. In production run `npm run db:sync-indexes -w @mp/api`
  as a deployment step.

## Conventions

Every schema is created with `createSchema()` (`lib/mongoose/base-schema.ts`):

- `createdAt` / `updatedAt` timestamps (audit logs: `createdAt` only).
- Strict mode — unknown paths are dropped.
- `toJSON` safety net: `id` instead of `_id`, no `__v`, secret fields (`passwordHash`,
  `tokenHash`, refresh-token hashes) removed. API responses still use explicit DTO mappers.
- References are `ObjectId` with `ref`.
- Secret-bearing fields use `select: false`.

### Deletion and archival

| Collection | Convention |
|---|---|
| Organization | `status: ARCHIVED` + `archivedAt` / `archivedBy`. Never hard-deleted via the API. |
| OrganizationMember | `status: REMOVED` + `removedAt` / `removedBy`. Re-inviting reactivates the same document. |
| Invitation | Terminal statuses `ACCEPTED`, `REVOKED`, `EXPIRED`; documents are kept. |
| Integration | `status: DISCONNECTED` + `disconnectedAt` / `disconnectedBy`; kept for history. |
| AdAccount | `archivedAt` when an account disappears upstream. |
| User | `status: SUSPENDED` / `DEACTIVATED`. |
| AuditLog | Append-only. Never updated or deleted by the application. |
| Session | Removed automatically by a TTL index at `expiresAt` (not business data). |

## Collections

| Collection | Tenant-owned | Purpose | Indexes |
|---|---|---|---|
| `users` | no | Global identity, password hash, lockout state, platform role | `email` unique; `status, createdAt` |
| `sessions` | no | One per signed-in device; refresh-token rotation state | `userId, revokedAt`; TTL on `expiresAt` |
| `organizations` | tenant root | Name, slug, timezone, currency, status | `slug` unique; `status, createdAt` |
| `organizationmembers` | yes | User ↔ organization with role and status | `organizationId, userId` unique; `organizationId, status, role`; `userId, status` |
| `invitations` | yes | Pending invitations (token stored as SHA-256 hash) | `tokenHash` unique; `organizationId, status, createdAt`; partial unique `organizationId, email` where `PENDING` |
| `integrations` | yes | Ad-platform connection registry | `organizationId, provider, status`; partial unique `organizationId, provider, externalAccountId` for live connections |
| `adaccounts` | yes | Ad accounts discovered through an integration | `organizationId, provider, externalId` unique; `organizationId, integrationId, archivedAt` |
| `auditlogs` | yes (nullable for user-level events) | Append-only audit trail | `organizationId, createdAt`; `organizationId, resourceType, resourceId, createdAt`; `organizationId, action, createdAt`; `actorUserId, createdAt` |

`Session` is the one collection beyond the initial list. Refresh-token rotation and
server-side revocation require server-side session state.

Every tenant-owned index starts with `organizationId`, so tenant-scoped queries are always
index-prefixed.

## Integration credentials

Not stored in M1. When OAuth ships, tokens will live in an encrypted, `select: false` field
(envelope encryption with a key from a KMS or a dedicated `ENCRYPTION_KEY`).

## Transactions

The code does not require a replica set. Organization creation (organization + owner
membership) uses a compensating delete if the second write fails. Last-owner checks are
read-then-write and can race under concurrent requests; Atlas supports transactions, and
moving these to `session.withTransaction` is listed under remaining work.
