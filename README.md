# Marketing Platform

Multi-tenant platform combining **digital advertising management** (Google Ads, Meta Ads),
a **sales CRM** and **AI marketing intelligence**.

This repository is at **Milestone 01 — Foundation & multi-tenant architecture**: authentication,
organizations, memberships, RBAC, tenant isolation, audit logging, integration registry,
the API/web foundations and the application shell. Campaign, CRM, analytics and AI modules
are planned for later milestones and appear in the UI as clearly marked placeholders.

## Quick start

Requirements: Node.js ≥ 22.12, npm ≥ 10, a MongoDB server (local or Atlas). Redis is optional.

```bash
npm install
cp .env.example .env            # then set MONGODB_URI and generate both JWT secrets
npm run dev                     # API on :4000, web on :3000
```

Open http://localhost:3000, create an account, then create your first organization.

| Command | What it does |
|---|---|
| `npm run dev` | API (watch) + web (dev server) |
| `npm run dev:worker` | BullMQ worker (requires `REDIS_URL`) |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run lint` | ESLint (zero warnings allowed) |
| `npm test` | All test suites (API tests start an in-memory MongoDB) |
| `npm run build` | Production builds (API bundle + Next.js) |
| `npm run start:api` / `start:web` / `start:worker` | Run production builds |
| `npm run check` | typecheck → lint → test → build |

## Layout

```
apps/
  api/        Express 5 REST API (modular monolith, domain modules)
  web/        Next.js 16 App Router dashboard
packages/
  config/     Zod environment schemas, shared tsconfig
  shared/     Roles, permissions, constants, error codes
  types/      API contracts (response envelope, DTOs)
  validators/ Zod request schemas used by API and web
docs/         Architecture and convention documentation
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [API conventions](docs/API_CONVENTIONS.md)
- [Authentication](docs/AUTHENTICATION.md)
- [Multi-tenancy](docs/MULTI_TENANCY.md)
- [RBAC](docs/RBAC.md)
- [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
- [Development](docs/DEVELOPMENT.md)
