import { Router } from 'express';
import { PERMISSIONS } from '@mp/shared';
import { listAuditLogsQuerySchema } from '@mp/validators';
import type { AppContext } from '../../app-context';
import { input, paginationMeta, sendSuccess } from '../../lib/http';
import { requireTenant } from '../../middleware/organization-context';
import { requirePermission } from '../../middleware/require-permission';

/** Read-only audit trail of the active organization. Mounted behind `requireOrganization`. */
export function createAuditRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', requirePermission(PERMISSIONS.AUDIT_READ), async (req, res) => {
    const query = input.query(req, listAuditLogsQuerySchema);
    const { items, total } = await ctx.audit.list(requireTenant(req), query);
    sendSuccess(res, { auditLogs: items }, { meta: { pagination: paginationMeta(query.page, query.limit, total) } });
  });

  return router;
}
