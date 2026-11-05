import { Router } from 'express';
import { PERMISSIONS } from '@mp/shared';
import { createOrganizationSchema, updateOrganizationSchema } from '@mp/validators';
import type { AppContext } from '../../app-context';
import { input, sendSuccess } from '../../lib/http';
import { requireAuth } from '../../middleware/authenticate';
import { requireOrganization, requireTenant } from '../../middleware/organization-context';
import { requirePermission } from '../../middleware/require-permission';
import { OrganizationService } from './organization.service';

/** Mounted behind `authenticate`. Routes with `:organizationId` verify membership first. */
export function createOrganizationRouter(ctx: AppContext): Router {
  const router = Router();
  const organizations = new OrganizationService(ctx);
  const tenant = requireOrganization(ctx, 'param');

  router.get('/', async (req, res) => {
    sendSuccess(res, { organizations: await organizations.listForUser(requireAuth(req).userId) });
  });

  router.post('/', async (req, res) => {
    const body = input.body(req, createOrganizationSchema);
    const organization = await organizations.create(req, requireAuth(req), body);
    sendSuccess(res, { organization }, { status: 201 });
  });

  router.get('/:organizationId', tenant, requirePermission(PERMISSIONS.ORGANIZATION_READ), (req, res) => {
    sendSuccess(res, { organization: organizations.describe(requireTenant(req)) });
  });

  router.patch('/:organizationId', tenant, requirePermission(PERMISSIONS.ORGANIZATION_UPDATE), async (req, res) => {
    const body = input.body(req, updateOrganizationSchema);
    const organization = await organizations.update(req, requireTenant(req), body);
    sendSuccess(res, { organization });
  });

  router.delete('/:organizationId', tenant, requirePermission(PERMISSIONS.ORGANIZATION_ARCHIVE), async (req, res) => {
    await organizations.archive(req, requireTenant(req), requireAuth(req));
    sendSuccess(res, { archived: true });
  });

  return router;
}
