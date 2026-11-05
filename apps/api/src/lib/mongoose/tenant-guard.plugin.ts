import type { MongooseQueryMiddleware, Schema } from 'mongoose';

/**
 * Defense-in-depth for multi-tenancy.
 *
 * Applied to every tenant-owned model, it rejects any query whose filter does not include
 * `organizationId`. Repositories always add the tenant scope; this plugin turns a forgotten
 * scope into an immediate error instead of a silent cross-tenant read or write.
 *
 * Deliberate cross-tenant queries (e.g. "list the organizations this user belongs to")
 * must opt out explicitly with `.setOptions({ skipTenantGuard: true })`, which keeps them
 * easy to find in code review.
 */

export class TenantGuardError extends Error {
  constructor(model: string, operation: string) {
    super(`Tenant guard: ${operation} on ${model} without an organizationId filter`);
    this.name = 'TenantGuardError';
  }
}

const QUERY_OPERATIONS: MongooseQueryMiddleware[] = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'countDocuments',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'distinct',
];

declare module 'mongoose' {
  interface QueryOptions {
    /** Explicitly allow a query without an organizationId filter. Use sparingly. */
    skipTenantGuard?: boolean;
  }
}

export function tenantGuardPlugin(schema: Schema): void {
  schema.pre(QUERY_OPERATIONS, { document: false, query: true }, function () {
    if (this.getOptions().skipTenantGuard) return;
    const filter = this.getFilter() as Record<string, unknown>;
    if (!filter || filter.organizationId === undefined) {
      throw new TenantGuardError(this.model.modelName, (this as unknown as { op?: string }).op ?? 'query');
    }
  });

  schema.pre('aggregate', function () {
    const options = this.options as { skipTenantGuard?: boolean };
    if (options.skipTenantGuard) return;
    const first = this.pipeline()[0] as { $match?: Record<string, unknown> } | undefined;
    if (!first?.$match || first.$match.organizationId === undefined) {
      throw new TenantGuardError(this.model().modelName, 'aggregate');
    }
  });
}
