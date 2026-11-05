# Architecture

## Shape

A **modular monolith** in an npm-workspaces monorepo. One API process, one optional worker
process, one web app. Domain boundaries live in code (modules), not in network hops.

```
Browser ──► Next.js web (:3000) ──/api/* rewrite──► Express API (:4000) ──► MongoDB
                                                         │
                                                         └──► Redis (optional) ◄── Worker (BullMQ)
```

- The browser only ever talks to the web origin. Next.js rewrites `/api/*` to `API_URL`, so
  auth cookies are first-party and no CORS preflights occur in normal use. CORS is still
  configured (allowlist) for direct API access.
- The worker (`apps/api/src/worker.ts`) runs the same codebase with a different entry point,
  so jobs share models and services without duplication.

## Packages

| Package | Responsibility | Consumed by |
|---|---|---|
| `@mp/config` | Zod env schemas (`server-env`, `web-env`), duration parsing, base tsconfig | api, web |
| `@mp/shared` | Roles, permissions + role matrix, error codes, statuses, audit actions, integration catalog | api, web |
| `@mp/types` | Response envelope and DTO interfaces — the API contract | api, web |
| `@mp/validators` | Zod request schemas (one source for API validation and form validation) | api, web |

Workspace packages ship TypeScript source (`exports` → `src/*.ts`). The API bundles them with
tsup (`noExternal: [/^@mp\//]`); Next.js compiles them via `transpilePackages`. There is no
separate package build step.

## API structure (`apps/api/src`)

```
config/            env loading + fail-fast validation
lib/               infrastructure: database, redis, logger, errors, http helpers, crypto, mailer, redaction
lib/mongoose/      base schema conventions, tenant-guard plugin, append-only plugin, TenantRepository
middleware/        request id/logging, security (CSRF origin check, key sanitization, CORS), rate limits,
                   authenticate, requireOrganization (tenant context), requirePermission, error handler
modules/<domain>/  model · repository · service · routes (+ mapper) per business domain
  auth/  users/  organizations/  members/  integrations/  audit/  health/
queues/            BullMQ queue registry
app.ts             express app factory (createApp(ctx))
app-context.ts     explicit dependency container (config, logger, redis, queues, mailer, tokens, audit)
bootstrap.ts       connects infrastructure, graceful shutdown, signal handling
server.ts / worker.ts / scripts/
```

Key decisions:

- **Explicit dependency context.** `createApp(ctx)` receives everything it needs; tests build
  a context with an in-memory MongoDB and a no-op mailer. No module-level singletons besides
  Mongoose's connection.
- **Routes are thin.** Parse input (`input.body(req, schema)`), call a service, send the
  envelope. Business rules (role assignment, last-owner protection, invitation lifecycle)
  live in services.
- **Repositories for tenant data.** `TenantRepository` scopes every query by
  `organizationId`; see [MULTI_TENANCY.md](MULTI_TENANCY.md).
- **DTO mappers.** Responses are built field-by-field from documents, never by serializing
  documents, so internal fields cannot leak.
- **Express 5 async errors.** Handlers throw `AppError`s; the central error handler turns
  every error into the standard envelope.

## Web structure (`apps/web/src`)

```
app/(auth)/        login, register (public)
app/(app)/         authenticated shell + all module routes
app/onboarding     first organization
app/invitations/accept
proxy.ts           optimistic redirect based on the session-hint cookie (not a security boundary)
components/ui      buttons, form fields, cards, badges, menu, dialog, states (loading/empty/error)
components/shell   app shell, sidebar, header, organization switcher, user menu, breadcrumbs, theme
features/          page-level feature code (dashboard chart, organization form, workspace queries)
lib/               api client (single-flight refresh), session/workspace context, navigation config
```

- **Server state via TanStack Query.** Tenant data is keyed `['org', organizationId, …]`;
  switching organizations removes other tenants' cached data.
- **Navigation is configuration.** `lib/navigation.ts` lists every module with its status
  (`available` / `planned`), permission and planned capabilities. Planned modules render an
  honest placeholder and never sample data.
- **Theming.** Semantic CSS tokens (`--surface`, `--muted`, …) mapped into Tailwind v4's
  `@theme`; dark mode swaps tokens via a `.dark` class set before first paint.

## Background processing

Redis + BullMQ are optional in this milestone. With `REDIS_URL`:
queues are created, rate-limit counters are shared across instances, and invitation emails are
queued for the worker. Without it: queues are disabled, rate limits are per-process, and email
is sent inline (or not at all when SMTP is unconfigured). A configured-but-unreachable Redis
fails startup rather than silently dropping jobs.

## Out of scope for M1 (by design)

Campaign creation, ad-platform OAuth/sync, CRM entities, AI agents, reports, email
verification and password reset. The permission catalog, integration models and queue
registry are shaped so these slot in without restructuring.
