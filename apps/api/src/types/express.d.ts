import type { AuthContext } from '../middleware/authenticate';
import type { TenantContext } from '../middleware/organization-context';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate` for signed-in requests. */
      auth?: AuthContext;
      /** Set by `requireOrganization` after membership has been verified. */
      tenant?: TenantContext;
    }
  }
}

export {};
