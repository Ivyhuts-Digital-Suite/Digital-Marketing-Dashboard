import type { Request } from 'express';
import { AUDIT_ACTIONS } from '@mp/shared';
import type { ChangePasswordInput, UpdateProfileInput } from '@mp/validators';
import type { AppContext } from '../../app-context';
import { Errors } from '../../lib/errors';
import type { AuthContext } from '../../middleware/authenticate';
import { AuthService } from '../auth/auth.service';
import { hashPassword, verifyPassword } from '../auth/password';
import { UserModel, type User } from './user.model';

export class UserService {
  private readonly auth: AuthService;

  constructor(private readonly ctx: AppContext) {
    this.auth = new AuthService(ctx);
  }

  async updateProfile(req: Request, actor: AuthContext, input: UpdateProfileInput) {
    const updated = await UserModel.findOneAndUpdate(
      { _id: actor.userId },
      { $set: { name: input.name } },
      { returnDocument: 'after', runValidators: true },
    ).lean<Omit<User, 'passwordHash'>>();
    if (!updated) throw Errors.notFound('User');

    await this.ctx.audit.recordFromRequest(req, {
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATE,
      resourceType: 'User',
      resourceId: actor.userId,
      metadata: { fields: ['name'] },
    });
    return updated;
  }

  /** Changes the password and signs out every other session. */
  async changePassword(req: Request, actor: AuthContext, input: ChangePasswordInput): Promise<number> {
    const user = await UserModel.findById(actor.userId).select('+passwordHash');
    if (!user) throw Errors.notFound('User');
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw Errors.validation([{ path: 'body.currentPassword', message: 'Current password is incorrect' }]);
    }

    user.passwordHash = await hashPassword(input.newPassword);
    user.passwordChangedAt = new Date();
    await user.save();

    const revokedSessions = await this.auth.revokeAllSessions(actor.userId, 'password_changed', actor.sessionId);
    await this.ctx.audit.recordFromRequest(req, {
      action: AUDIT_ACTIONS.USER_PASSWORD_CHANGE,
      resourceType: 'User',
      resourceId: actor.userId,
      metadata: { revokedSessions },
    });
    return revokedSessions;
  }
}
