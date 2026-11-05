import type { Model, QueryFilter, Types, UpdateQuery } from 'mongoose';

/** The minimal tenant scope every tenant-owned data access requires. */
export interface TenantScope {
  organizationId: Types.ObjectId;
}

/**
 * Base repository for tenant-owned collections. Every read and write is constrained to
 * `scope.organizationId`; the scope is applied last so a caller-supplied filter can never
 * widen or replace it.
 */
export class TenantRepository<T extends { organizationId: Types.ObjectId }> {
  constructor(protected readonly model: Model<T>) {}

  protected scoped(scope: TenantScope, filter: QueryFilter<T> = {}): QueryFilter<T> {
    return { ...filter, organizationId: scope.organizationId } as QueryFilter<T>;
  }

  findById(scope: TenantScope, id: string | Types.ObjectId) {
    return this.model.findOne(this.scoped(scope, { _id: id } as QueryFilter<T>));
  }

  findOne(scope: TenantScope, filter: QueryFilter<T>) {
    return this.model.findOne(this.scoped(scope, filter));
  }

  find(scope: TenantScope, filter: QueryFilter<T> = {}) {
    return this.model.find(this.scoped(scope, filter));
  }

  count(scope: TenantScope, filter: QueryFilter<T> = {}) {
    return this.model.countDocuments(this.scoped(scope, filter));
  }

  create(scope: TenantScope, data: Omit<Partial<T>, 'organizationId'>) {
    return new this.model({ ...data, organizationId: scope.organizationId }).save();
  }

  updateById(scope: TenantScope, id: string | Types.ObjectId, update: UpdateQuery<T>) {
    return this.model.findOneAndUpdate(this.scoped(scope, { _id: id } as QueryFilter<T>), update, {
      returnDocument: 'after',
      runValidators: true,
    });
  }
}
