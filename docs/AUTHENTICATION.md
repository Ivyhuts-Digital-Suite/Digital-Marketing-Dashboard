# Authentication

## Overview

| Concern | Implementation |
|---|---|
| Password hashing | Argon2id, 19 MiB / t=2 / p=1 (OWASP minimum); parameters upgraded transparently on login (`needsRehash`) |
| Password policy | 12–128 characters, at least one letter and one non-letter |
| Access token | JWT HS256, 15 min (`JWT_ACCESS_EXPIRES_IN`), claims `sub`, `sid`, `typ=access`, `iss`, `aud` |
| Refresh token | JWT HS256 with a separate secret, `jti` = random 192-bit id, `typ=refresh`; expires with the session |
| Session | `sessions` collection, one per login; stores only SHA-256 hashes of refresh-token ids |
| Transport | HttpOnly cookies (`Secure` in production); `Authorization: Bearer` also accepted for API clients |

## Cookies

| Cookie | HttpOnly | SameSite | Path | Lifetime | Purpose |
|---|---|---|---|---|---|
| `mp_access` | yes | Lax | `/` | access TTL | Access token |
| `mp_refresh` | yes | Strict | `/api/v1/auth` | session expiry | Refresh token, only sent to auth endpoints |
| `mp_session` | **no** | Lax | `/` | session expiry | Value `1`. Lets the Next.js proxy redirect optimistically. Grants nothing. |

Tokens are never returned in response bodies, so page scripts cannot read them.

## Flows

**Register / login** → verify input → create `Session` (`refreshTokenHash = sha256(jti)`,
`expiresAt = now + JWT_REFRESH_EXPIRES_IN`) → set cookies → audit `auth.register` / `auth.login`.

**Every authenticated request** (`middleware/authenticate.ts`): verify the access JWT, then
load the session and user. The request is rejected if the session is revoked or expired, or
the user is not `ACTIVE`. Logout, "sign out everywhere", password changes and suspensions
therefore take effect immediately rather than when the access token expires.

**Refresh with rotation** (`AuthService.refresh`):

1. Verify the refresh JWT and load its session (must be live and belong to `sub`).
2. If `sha256(jti)` equals the current hash, atomically swap in a new hash
   (`findOneAndUpdate` conditioned on the old hash) and issue new cookies. The expiry stays
   the session's absolute `expiresAt`.
3. If it equals the *previous* hash and the rotation happened within 30s, this is a
   concurrent refresh from another tab. Respond `200 { rotated: false }` without new cookies;
   the browser already holds the winner's cookies.
4. Any other token is **reuse**: revoke the session (`reuse_detected`), audit
   `auth.refresh_reuse_detected`, and return 401. A stolen refresh token kills the
   attacker's and the victim's copies alike.

The web client deduplicates refresh calls (single-flight) and retries the original request once.

**Logout** revokes the session identified by the refresh or access token (whichever verifies)
and always clears cookies. **Logout-all** revokes every session of the user. **Password
change** requires the current password and revokes all *other* sessions.

## Brute-force protection

- IP rate limit: 20 credential attempts per 15 minutes (`429 RATE_LIMITED`).
- Account lockout: 5 consecutive failures lock the account for 15 minutes
  (`423 ACCOUNT_LOCKED`, even with the right password). Success resets the counter.
- Unknown emails are verified against a dummy hash, so timing does not reveal account existence.
- Wrong password and unknown email return the identical `401 INVALID_CREDENTIALS`.
  Account status is only checked after a correct password.
- Trade-offs: the lockout message, and `409` on duplicate registration, do reveal that an
  account exists. Both are standard usability choices.

## Account status

`ACTIVE`, `SUSPENDED`, `DEACTIVATED`. Non-active users cannot sign in, and their existing
sessions stop working on the next request.

## Platform role

`User.platformRole` is `USER` or `SUPER_ADMIN`. No API endpoint grants it. Use the operator CLI:

```bash
npm run user:grant-super-admin -w @mp/api -- someone@example.com            # grant
npm run user:grant-super-admin -w @mp/api -- someone@example.com --revoke   # revoke
```

## Awaiting credentials / not yet implemented

| Feature | Status |
|---|---|
| Email verification | **Not implemented.** `emailVerifiedAt` exists on the user and the UI shows "unverified"; the flow needs SMTP plus a verification-token store. |
| Password reset | **Not implemented.** Same dependencies as email verification. |
| Invitation emails | **Implemented, awaiting SMTP.** Without `SMTP_*`, the one-time invitation link is returned once to the inviter. With SMTP (and Redis), mail is queued for the worker. |
| MFA / SSO | Not in M1. |
