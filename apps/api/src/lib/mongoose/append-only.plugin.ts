import type { MongooseQueryMiddleware, Schema } from 'mongoose';

/**
 * Makes a collection append-only through the application: documents may be created,
 * never updated or deleted via Mongoose. (Database-level enforcement — a restricted
 * MongoDB role without update/remove on the collection — is recommended in production.)
 */
export class AppendOnlyError extends Error {
  constructor(model: string, operation: string) {
    super(`${model} is append-only; ${operation} is not permitted`);
    this.name = 'AppendOnlyError';
  }
}

const MUTATIONS: MongooseQueryMiddleware[] = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
];

function modelNameOf(doc: unknown): string {
  return (doc as { constructor: { modelName?: string } }).constructor.modelName ?? 'Model';
}

export function appendOnlyPlugin(schema: Schema): void {
  schema.pre(MUTATIONS, { document: false, query: true }, function () {
    throw new AppendOnlyError(this.model.modelName, (this as unknown as { op?: string }).op ?? 'mutation');
  });

  // Document-level deleteOne()
  schema.pre('deleteOne', { document: true, query: false }, function () {
    throw new AppendOnlyError(modelNameOf(this), 'deleteOne');
  });

  schema.pre('save', function () {
    if (!this.isNew) throw new AppendOnlyError(modelNameOf(this), 'update via save');
  });

  schema.pre('bulkWrite', function () {
    throw new AppendOnlyError(this.modelName, 'bulkWrite');
  });
}
