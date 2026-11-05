import { Router } from 'express';
import { changePasswordSchema, updateProfileSchema } from '@mp/validators';
import type { AppContext } from '../../app-context';
import { input, sendSuccess } from '../../lib/http';
import { requireAuth } from '../../middleware/authenticate';
import type { RateLimiters } from '../../middleware/rate-limit';
import { toUserDto } from './user.mapper';
import { UserService } from './user.service';

/** Self-service user endpoints. Mounted behind `authenticate`. */
export function createUserRouter(ctx: AppContext, limiters: RateLimiters): Router {
  const router = Router();
  const users = new UserService(ctx);

  router.get('/me', (req, res) => {
    sendSuccess(res, { user: toUserDto(requireAuth(req).user) });
  });

  router.patch('/me', async (req, res) => {
    const body = input.body(req, updateProfileSchema);
    const user = await users.updateProfile(req, requireAuth(req), body);
    sendSuccess(res, { user: toUserDto(user) });
  });

  router.post('/me/password', limiters.auth, async (req, res) => {
    const body = input.body(req, changePasswordSchema);
    const revokedSessions = await users.changePassword(req, requireAuth(req), body);
    sendSuccess(res, { passwordChanged: true, revokedSessions });
  });

  return router;
}
