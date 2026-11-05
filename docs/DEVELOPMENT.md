# Development

## Prerequisites

- Node.js ≥ 22.12 (developed on Node 25) and npm ≥ 10
- MongoDB: local `mongod` 7+ or an Atlas cluster
- Optional: Redis 6.2+ (BullMQ, shared rate limits, worker)

## Setup

```bash
npm install
cp .env.example .env
# set MONGODB_URI, then generate the two JWT secrets:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
npm run dev
```

- Web: http://localhost:3000 (proxies `/api/*` to the API)
- API: http://localhost:4000/api/v1/health

Optional Redis via Docker: `docker run -p 6379:6379 redis:7`, then set
`REDIS_URL=redis://localhost:6379` and run `npm run dev:worker` in a second terminal.

> npm 11 may warn that install scripts for `argon2`, `esbuild` and `mongodb-memory-server` were
> not run. The packages ship prebuilt binaries and work without them; approve with
> `npm install-scripts approve <pkg>` if your policy requires it.

## Scripts

| Root script | Description |
|---|---|
| `npm run dev` | API (tsx watch) + web (Next dev, Turbopack) |
| `npm run dev:api` / `dev:web` / `dev:worker` | Individual processes |
| `npm run typecheck` | `tsc --noEmit` in every workspace (`next typegen` first for web) |
| `npm run lint` / `lint:fix` | ESLint flat config at the root, zero warnings |
| `npm test` | Vitest in every workspace |
| `npm run build` | tsup API bundle → `apps/api/dist`; `next build` → `apps/web/.next` |
| `npm run check` | typecheck + lint + test + build |
| `npm run db:sync-indexes -w @mp/api` | Create/sync MongoDB indexes (production deploy step) |
| `npm run user:grant-super-admin -w @mp/api -- <email> [--revoke]` | Platform role CLI |

## Tests

- **API** (`apps/api/test`): Vitest + Supertest against a real `mongod` started by
  `mongodb-memory-server` (one server per run, one database per test file). The first run
  downloads a MongoDB binary. To use a local install instead:
  `MONGOMS_SYSTEM_BINARY="C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" npm test`
  or point at a running server with `TEST_MONGODB_URI`.
- **Packages**: unit tests for env validation (`config`), the RBAC matrix (`shared`) and
  schemas (`validators`).
- **Web**: unit tests for redirect safety, navigation, form-error mapping and chart bucketing.

| Suite | Covers |
|---|---|
| `auth.test.ts` | registration, login/logout, logout-all, refresh rotation + reuse detection + race grace, unauthorized/forged/expired tokens, suspended users, lockout, rate limiting, password change |
| `organizations.test.ts` | organization CRUD/archive, invitations, memberships, RBAC enforcement, role-rank rules, last-owner protection, super-admin support access |
| `tenant-isolation.test.ts` | Organization A vs Organization B cross-tenant rejection |
| `integrations-audit.test.ts` | integration catalog availability, 501 connect, disconnect + audit, audit API, secret-free audit metadata |
| `security-health.test.ts` | health/readiness (incl. Redis down → 503), envelopes, headers, NoSQL/prototype injection, body limits, CORS, CSRF origin check |
| `database.test.ts` | connection lifecycle + fail-fast, hidden fields, unique indexes, tenant guard, append-only audit log, critical audit writes |
| `unit.test.ts` | redaction, mailer delivery strategy |

## Conventions

- TypeScript strict everywhere, `verbatimModuleSyntax` (use `import type`).
- Backend modules by domain: `modules/<domain>/{model,repository,service,routes,mapper}.ts`.
- Validation schemas live in `@mp/validators`, response types in `@mp/types`.
- Tenant data only through `TenantRepository`; see [MULTI_TENANCY.md](MULTI_TENANCY.md).
- State changes record an audit entry; secrets never go into logs or audit metadata.
- UI uses semantic color tokens (`bg-surface`, `text-muted`, …), not raw palette classes.
- Planned modules render `ModulePlaceholder`. Never show sample data that could be mistaken
  for real account data.

## Production notes

- `NODE_ENV=production` → `Secure` cookies, autoIndex off (run `db:sync-indexes`), and
  placeholder secrets rejected.
- Run the API, worker and web as separate processes. Set `TRUST_PROXY` to the number of proxies
  in front of the API.
- Health checks: liveness `GET /api/v1/health`, readiness `GET /api/v1/health/ready`.
- Recommended: give the API a MongoDB user without `update`/`remove` on `auditlogs`
  (database-level append-only).
