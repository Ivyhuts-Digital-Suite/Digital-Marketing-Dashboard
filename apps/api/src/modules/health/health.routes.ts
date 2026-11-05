import { Router } from 'express';
import type { HealthResponse, ReadinessResponse } from '@mp/types';
import type { AppContext } from '../../app-context';
import { checkDatabase } from '../../lib/database';
import { sendSuccess } from '../../lib/http';
import { checkRedis } from '../../lib/redis';

const VERSION = process.env.npm_package_version ?? '0.1.0';

/**
 * - GET /health        Liveness: the process is up and serving. No dependency checks.
 * - GET /health/ready  Readiness: MongoDB (required) and Redis (when configured) respond.
 *                      Returns 503 when not ready so load balancers stop routing traffic.
 */
export function createHealthRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      service: 'marketing-platform-api',
      version: VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    sendSuccess(res, body);
  });

  router.get('/ready', async (_req, res) => {
    const [mongodb, redis] = await Promise.all([checkDatabase(), checkRedis(ctx.redis)]);
    const ready = mongodb.status === 'up' && redis.status !== 'down';
    const body: ReadinessResponse = { status: ready ? 'ready' : 'not_ready', checks: { mongodb, redis } };
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, body, { status: ready ? 200 : 503 });
  });

  return router;
}
