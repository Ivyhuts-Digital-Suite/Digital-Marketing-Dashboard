# API conventions

Base path: **`/api/v1`**. Breaking changes ship under a new version prefix.

## Response envelope

Success:

```json
{ "success": true, "data": { "organization": { "id": "…" } }, "meta": { "pagination": { "page": 1, "limit": 25, "total": 3, "totalPages": 1 } } }
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid",
    "details": [{ "path": "body.email", "message": "Must be a valid email address" }],
    "requestId": "3f2c…"
  }
}
```

- `data` is always an object with named keys (`{ "members": [...] }`), never a bare array,
  so fields can be added without breaking clients.
- `meta.pagination` accompanies paginated lists (`?page=&limit=`, max limit 100).
- `error.code` is stable and machine-readable (`@mp/shared` → `ERROR_CODES`). `message` is
  safe to show to users. Internal errors are always `INTERNAL_ERROR` with a generic message;
  stack traces and database errors are logged, never returned.

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR`, `BAD_REQUEST`, `ORGANIZATION_REQUIRED` |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED` (refresh and retry), `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN`, `ORGANIZATION_ACCESS_DENIED`, `ACCOUNT_DISABLED` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 423 | `ACCOUNT_LOCKED` |
| 429 | `RATE_LIMITED` |
| 501 | `NOT_IMPLEMENTED` |
| 503 | readiness `not_ready` |

## Requests

- JSON only, 100 KB body limit. Query strings use the simple parser (no nested objects).
- Every input is validated with a strict Zod schema from `@mp/validators`. Unknown fields are
  rejected (prevents mass assignment such as `platformRole` or `organizationId` in bodies).
- Keys starting with `$` and prototype keys (`__proto__`, `constructor`, `prototype`) are
  rejected anywhere in body, query or params.
- **Tenant selection:** send `X-Organization-Id` on tenant-scoped routes. Routes under
  `/organizations/:organizationId` take it from the path. See [MULTI_TENANCY.md](MULTI_TENANCY.md).
- `X-Request-Id` is accepted if well-formed (8–64 chars `[A-Za-z0-9._-]`) and always echoed.

## Endpoints

| Method & path | Auth | Permission | Notes |
|---|---|---|---|
| `GET /health` | – | – | Liveness |
| `GET /health/ready` | – | – | MongoDB + Redis checks; 503 when not ready |
| `POST /auth/register` | – | – | Sets auth cookies; 201 |
| `POST /auth/login` | – | – | Sets auth cookies |
| `POST /auth/refresh` | refresh cookie | – | Rotates refresh token |
| `POST /auth/logout` | optional | – | Revokes current session, clears cookies |
| `POST /auth/logout-all` | ✓ | – | Revokes every session of the user |
| `GET /auth/me` | ✓ | – | User + accessible organizations with permissions |
| `GET /users/me` · `PATCH /users/me` | ✓ | – | Profile |
| `POST /users/me/password` | ✓ | – | Requires current password; revokes other sessions |
| `GET /organizations` | ✓ | – | Organizations the user is an active member of |
| `POST /organizations` | ✓ | – | Creator becomes owner |
| `GET /organizations/:organizationId` | ✓ | `organization:read` | |
| `PATCH /organizations/:organizationId` | ✓ | `organization:update` | |
| `DELETE /organizations/:organizationId` | ✓ | `organization:archive` | Archives (soft delete) |
| `GET /organization-members` | ✓ + org | `members:read` | |
| `PATCH /organization-members/:memberId` | ✓ + org | `members:update_role` | Role-rank rules apply |
| `DELETE /organization-members/:memberId` | ✓ + org | `members:remove` | Last owner protected |
| `GET /organization-members/invitations` | ✓ + org | `members:invite` | Pending only |
| `POST /organization-members/invitations` | ✓ + org | `members:invite` | Returns `acceptUrl` once if SMTP is unconfigured |
| `DELETE /organization-members/invitations/:invitationId` | ✓ + org | `members:invite` | Revoke |
| `POST /organization-members/invitations/accept` | ✓ | – | Token decides the organization; email must match |
| `GET /integrations` | ✓ + org | `integrations:read` | Provider catalog with real availability + connections |
| `GET /integrations/:integrationId` | ✓ + org | `integrations:read` | |
| `GET /integrations/:integrationId/ad-accounts` | ✓ + org | `integrations:read` | |
| `POST /integrations/providers/:provider/connect` | ✓ + org | `integrations:manage` | **501** until the integrations milestone |
| `DELETE /integrations/:integrationId` | ✓ + org | `integrations:manage` | Marks DISCONNECTED; audited |
| `GET /audit-logs` | ✓ + org | `audit:read` | `?page&limit&action&resourceType&since` |

## Security middleware order

`requestId → requestLogger → helmet → cors → json(100kb) → cookieParser → rejectDisallowedKeys →
/health → globalRateLimit → verifyOrigin → routes → notFound → errorHandler`

- **Rate limits** (per client IP): 300 req/min globally; 20 per 15 min on register/login/password
  change; 120 per 15 min on refresh. Shared via Redis when configured.
- **CSRF:** cookies are `SameSite` (Lax/Strict), and state-changing requests carrying an
  `Origin` outside the allowlist, or `Sec-Fetch-Site: cross-site`, are rejected with 403.
- **Logging:** pino JSON logs with request ID; `Authorization`, `Cookie`, `Set-Cookie` and
  password/token fields are redacted.

## Adding an endpoint

1. Add the Zod schema to `@mp/validators` and any DTO type to `@mp/types`.
2. Put logic in the module's service; use a `TenantRepository` for tenant data.
3. In the router: `requirePermission(PERMISSIONS.X)`, `input.body(req, schema)`, `sendSuccess`.
4. Record an audit entry for state changes (add the action to `AUDIT_ACTIONS`).
5. Add an integration test, including a cross-tenant case.
