import type { RequestHandler } from 'express';
import { hasAllPermissions, type Permission } from '@mp/shared';
import { Errors } from '../lib/errors';
import { requireTenant } from './organization-context';

/**
 * Authorizes a tenant-scoped request by permission (never by role name). Must be mounted
 * after `requireOrganization`, which resolves the caller's effective permissions.
 */
export function requirePermission(...required: Permission[]): RequestHandler {
  return (req, _res, next) => {
    const tenant = requireTenant(req);
    if (!hasAllPermissions(tenant.permissions, required)) throw Errors.forbidden();
    next();
  };
}
