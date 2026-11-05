import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { API_PREFIX } from '@mp/shared';
import type { AppContext } from './app-context';
import { authenticate } from './middleware/authenticate';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requireOrganization } from './middleware/organization-context';
import { createRateLimiters, DEFAULT_RATE_LIMITS, type RateLimitSettings } from './middleware/rate-limit';
import { requestId, requestLogger } from './middleware/request-logging';
import { corsOptions, rejectDisallowedKeys, verifyOrigin } from './middleware/security';
import { createAuditRouter } from './modules/audit/audit.routes';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createHealthRouter } from './modules/health/health.routes';
import { createIntegrationRouter } from './modules/integrations/integration.routes';
import { createMemberRouter } from './modules/members/member.routes';
import { createOrganizationRouter } from './modules/organizations/organization.routes';
import { createUserRouter } from './modules/users/user.routes';

export interface AppOptions {
  rateLimits?: Partial<RateLimitSettings>;
}

const BODY_LIMIT = '100kb';

export function createApp(ctx: AppContext, options: AppOptions = {}): Express {
  const app = express();
  const { config } = ctx;
  const limiters = createRateLimiters({ ...DEFAULT_RATE_LIMITS, ...options.rateLimits }, ctx.redis);

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  // Flat query strings only: `?a[$ne]=x` stays a literal key instead of becoming an object.
  app.set('query parser', 'simple');

  app.use(requestId());
  app.use(requestLogger(ctx.logger));
  app.use(helmet());
  app.use(cors(corsOptions(config.cors.allowedOrigins)));
  app.use(express.json({ limit: BODY_LIMIT, strict: true }));
  app.use(cookieParser());
  app.use(rejectDisallowedKeys);

  const api = Router();
  api.use('/health', createHealthRouter(ctx));
  api.use(limiters.global);
  api.use(verifyOrigin(config.cors.allowedOrigins));

  const auth = authenticate(ctx);
  api.use('/auth', createAuthRouter(ctx, limiters));
  api.use('/users', auth, createUserRouter(ctx, limiters));
  api.use('/organizations', auth, createOrganizationRouter(ctx));
  api.use('/organization-members', auth, createMemberRouter(ctx));
  api.use('/integrations', auth, requireOrganization(ctx), createIntegrationRouter(ctx));
  api.use('/audit-logs', auth, requireOrganization(ctx), createAuditRouter(ctx));

  app.use(API_PREFIX, api);
  app.use(notFoundHandler);
  app.use(errorHandler(ctx.logger));

  return app;
}
