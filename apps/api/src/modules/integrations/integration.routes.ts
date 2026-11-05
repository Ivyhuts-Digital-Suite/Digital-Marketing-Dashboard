import { Router } from 'express';
import { PERMISSIONS } from '@mp/shared';
import { integrationIdParamSchema, integrationProviderParamSchema } from '@mp/validators';
import type { AppContext } from '../../app-context';
import { input, sendSuccess } from '../../lib/http';
import { requireAuth } from '../../middleware/authenticate';
import { requireTenant } from '../../middleware/organization-context';
import { requirePermission } from '../../middleware/require-permission';
import { IntegrationService } from './integration.service';

/** Mounted behind `authenticate` and `requireOrganization`. */
export function createIntegrationRouter(ctx: AppContext): Router {
  const router = Router();
  const integrations = new IntegrationService(ctx);

  router.get('/', requirePermission(PERMISSIONS.INTEGRATIONS_READ), async (req, res) => {
    sendSuccess(res, { providers: await integrations.catalog(requireTenant(req)) });
  });

  router.post('/providers/:provider/connect', requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE), (req) => {
    const { provider } = input.params(req, integrationProviderParamSchema);
    integrations.connect(provider);
  });

  router.get('/:integrationId', requirePermission(PERMISSIONS.INTEGRATIONS_READ), async (req, res) => {
    const { integrationId } = input.params(req, integrationIdParamSchema);
    sendSuccess(res, { integration: await integrations.get(requireTenant(req), integrationId) });
  });

  router.get('/:integrationId/ad-accounts', requirePermission(PERMISSIONS.INTEGRATIONS_READ), async (req, res) => {
    const { integrationId } = input.params(req, integrationIdParamSchema);
    sendSuccess(res, { adAccounts: await integrations.listAdAccounts(requireTenant(req), integrationId) });
  });

  router.delete('/:integrationId', requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE), async (req, res) => {
    const { integrationId } = input.params(req, integrationIdParamSchema);
    const integration = await integrations.disconnect(req, requireTenant(req), requireAuth(req), integrationId);
    sendSuccess(res, { integration });
  });

  return router;
}
