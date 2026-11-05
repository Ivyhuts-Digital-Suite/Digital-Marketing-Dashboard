import { Router, type Request } from 'express';
import { loginSchema, registerSchema } from '@mp/validators';
import type { AppContext } from '../../app-context';
import { clientIp, input, sendSuccess } from '../../lib/http';
import { Errors } from '../../lib/errors';
import { authenticate, requireAuth } from '../../middleware/authenticate';
import type { RateLimiters } from '../../middleware/rate-limit';
import { OrganizationService } from '../organizations/organization.service';
import { toUserDto } from '../users/user.mapper';
import { AuthService, type RequestMeta } from './auth.service';
import { clearAuthCookies, readAccessToken, readRefreshToken, setAuthCookies } from './cookies';

export function requestMeta(req: Request): RequestMeta {
  return { ipAddress: clientIp(req), userAgent: req.get('user-agent') ?? null, requestId: String(req.id) };
}

export function createAuthRouter(ctx: AppContext, limiters: RateLimiters): Router {
  const router = Router();
  const auth = new AuthService(ctx);
  const organizations = new OrganizationService(ctx);

  router.post('/register', limiters.auth, async (req, res) => {
    const body = input.body(req, registerSchema);
    const { user, tokens } = await auth.register(body, requestMeta(req));
    setAuthCookies(res, ctx.config, tokens);
    sendSuccess(res, { user: toUserDto(user) }, { status: 201 });
  });

  router.post('/login', limiters.auth, async (req, res) => {
    const body = input.body(req, loginSchema);
    const { user, tokens } = await auth.login(body, requestMeta(req));
    setAuthCookies(res, ctx.config, tokens);
    sendSuccess(res, { user: toUserDto(user) });
  });

  router.post('/refresh', limiters.refresh, async (req, res) => {
    const refreshToken = readRefreshToken(req);
    if (!refreshToken) throw Errors.unauthenticated('No refresh token');
    try {
      const tokens = await auth.refresh(refreshToken, requestMeta(req));
      if (tokens) setAuthCookies(res, ctx.config, tokens);
      sendSuccess(res, { rotated: Boolean(tokens) });
    } catch (error) {
      clearAuthCookies(res, ctx.config);
      throw error;
    }
  });

  router.post('/logout', async (req, res) => {
    await auth.logout({ accessToken: readAccessToken(req), refreshToken: readRefreshToken(req) }, requestMeta(req));
    clearAuthCookies(res, ctx.config);
    sendSuccess(res, { signedOut: true });
  });

  router.post('/logout-all', authenticate(ctx), async (req, res) => {
    const { userId } = requireAuth(req);
    const revokedSessions = await auth.logoutAll(userId, requestMeta(req));
    clearAuthCookies(res, ctx.config);
    sendSuccess(res, { revokedSessions });
  });

  /** Current user plus the organizations they can access: everything the web app needs to boot. */
  router.get('/me', authenticate(ctx), async (req, res) => {
    const { user } = requireAuth(req);
    sendSuccess(res, {
      user: toUserDto(user),
      organizations: await organizations.listForUser(user._id),
    });
  });

  return router;
}
