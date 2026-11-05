# Environment variables

A single `.env` at the repository root (copy `.env.example`; never commit `.env`). Real
environment variables override the file.

- **API / worker** validate everything with Zod at startup (`packages/config/src/server-env.ts`).
  Invalid configuration prints the variable names and problems, never the values, and exits 1.
- **Web** reads only `API_URL` and `NEXT_PUBLIC_*` from the root `.env` (`apps/web/next.config.ts`).
  Backend secrets never enter the Next.js process, and only `NEXT_PUBLIC_*` reaches the browser.
- Blank values count as unset.
- **Credential groups are all-or-nothing:** setting some of a provider's variables but not all
  is a startup error, so a half-configured provider never reaches runtime.

## Application

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production`. Production enables `Secure` cookies and placeholder-secret rejection. |
| `WEB_URL` | no | `http://localhost:3000` | Public web URL. Always in the CORS/origin allowlist; used in invitation links. |
| `API_URL` | no | `http://localhost:4000` | API base URL. The web server proxies `/api/*` here. |
| `API_PORT` | no | `4000` | API listen port. |
| `LOG_LEVEL` | no | `info` | pino level (`fatal`…`trace`, `silent`). |
| `CORS_ALLOWED_ORIGINS` | no | – | Extra comma-separated origins allowed for CORS and CSRF origin checks. |
| `TRUST_PROXY` | no | `0` | Number of trusted proxy hops for client-IP detection. Use `1` behind the Next.js proxy or one load balancer. Do not set it when the API is directly exposed, or `X-Forwarded-For` becomes spoofable. |
| `COOKIE_DOMAIN` | no | – | Cookie domain, e.g. `.example.com` for sibling subdomains. |

## Database

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGODB_URI` | **yes** | – | `mongodb://` or `mongodb+srv://` (Atlas). |
| `MONGODB_DB_NAME` | no | from URI | Overrides the database name. |
| `REDIS_URL` | no | – | `redis://` / `rediss://`. Enables BullMQ queues, the worker and shared rate limits. If set but unreachable, startup fails. |

## Authentication

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | **yes** | – | ≥ 32 chars. HS256 key for access tokens. |
| `JWT_REFRESH_SECRET` | **yes** | – | ≥ 32 chars and different from the access secret. |
| `JWT_ACCESS_EXPIRES_IN` | no | `15m` | Duration: `<n>s\|m\|h\|d`. |
| `JWT_REFRESH_EXPIRES_IN` | no | `30d` | Absolute session lifetime. |

Generate secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
In production, values that look like placeholders (`change-me`, `example`, …) are rejected.

## Google Ads — planned (integrations milestone)

All four or none. When complete, the catalog shows Google Ads as `COMING_SOON` rather than `NOT_CONFIGURED`.

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_DEVELOPER_TOKEN` | Google Ads API developer token |
| `GOOGLE_REDIRECT_URI` | OAuth redirect URL (must be a URL) |

## Meta — planned (integrations milestone)

All three or none: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` (URL).

## AI providers — planned (AI milestone)

`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GEMINI_API_KEY`. Optional and independent;
validated and exposed on the server config only. No code uses them in M1.

## Storage — planned

| Variable | Default | Description |
|---|---|---|
| `STORAGE_PROVIDER` | `local` | `local` \| `s3` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION` | – | All required when `STORAGE_PROVIDER=s3` |

## Email

| Variable | Description |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM` | Group: all or none. Enables invitation emails (port 465 uses implicit TLS). |
| `SMTP_USER`, `SMTP_PASSWORD` | Group: both or neither. SMTP authentication. |

Without SMTP, invitation links are returned once to the inviter for manual sharing.

## Web (public)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | `Marketing Platform` | Product name in the UI. Never put secrets in `NEXT_PUBLIC_*`. |

## Test-only

| Variable | Description |
|---|---|
| `TEST_MONGODB_URI` | Run API tests against an existing MongoDB instead of an in-memory server. |
| `MONGOMS_SYSTEM_BINARY` | Path to a local `mongod` for the in-memory server (skips the binary download). |
