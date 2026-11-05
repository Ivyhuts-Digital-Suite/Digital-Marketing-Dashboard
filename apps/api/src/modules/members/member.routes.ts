import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@mp/shared';
import { acceptInvitationSchema, createInvitationSchema, objectIdSchema, updateMemberRoleSchema } from '@mp/validators';
import type { AppContext } from '../../app-context';
import { input, sendSuccess } from '../../lib/http';
import { requireAuth } from '../../middleware/authenticate';
import { requireOrganization, requireTenant } from '../../middleware/organization-context';
import { requirePermission } from '../../middleware/require-permission';
import { MemberService } from './member.service';

const memberParams = z.object({ memberId: objectIdSchema }).strict();
const invitationParams = z.object({ invitationId: objectIdSchema }).strict();

/**
 * /organization-members — memberships and invitations of the active organization
 * (selected with the X-Organization-Id header). Mounted behind `authenticate`.
 */
export function createMemberRouter(ctx: AppContext): Router {
  const router = Router();
  const members = new MemberService(ctx);

  // Acceptance is resolved from the invitation token, not from an organization header.
  router.post('/invitations/accept', async (req, res) => {
    const { token } = input.body(req, acceptInvitationSchema);
    const organization = await members.acceptInvitation(req, requireAuth(req), token);
    sendSuccess(res, { organization });
  });

  router.use(requireOrganization(ctx, 'header'));

  router.get('/', requirePermission(PERMISSIONS.MEMBERS_READ), async (req, res) => {
    sendSuccess(res, { members: await members.list(requireTenant(req)) });
  });

  router.get('/invitations', requirePermission(PERMISSIONS.MEMBERS_INVITE), async (req, res) => {
    sendSuccess(res, { invitations: await members.listInvitations(requireTenant(req)) });
  });

  router.post('/invitations', requirePermission(PERMISSIONS.MEMBERS_INVITE), async (req, res) => {
    const body = input.body(req, createInvitationSchema);
    const result = await members.createInvitation(req, requireTenant(req), requireAuth(req), body);
    sendSuccess(res, result, { status: 201 });
  });

  router.delete('/invitations/:invitationId', requirePermission(PERMISSIONS.MEMBERS_INVITE), async (req, res) => {
    const { invitationId } = input.params(req, invitationParams);
    await members.revokeInvitation(req, requireTenant(req), requireAuth(req), invitationId);
    sendSuccess(res, { revoked: true });
  });

  router.patch('/:memberId', requirePermission(PERMISSIONS.MEMBERS_UPDATE_ROLE), async (req, res) => {
    const { memberId } = input.params(req, memberParams);
    const { role } = input.body(req, updateMemberRoleSchema);
    const member = await members.updateRole(req, requireTenant(req), requireAuth(req), memberId, role);
    sendSuccess(res, { member });
  });

  router.delete('/:memberId', requirePermission(PERMISSIONS.MEMBERS_REMOVE), async (req, res) => {
    const { memberId } = input.params(req, memberParams);
    await members.remove(req, requireTenant(req), requireAuth(req), memberId);
    sendSuccess(res, { removed: true });
  });

  return router;
}
