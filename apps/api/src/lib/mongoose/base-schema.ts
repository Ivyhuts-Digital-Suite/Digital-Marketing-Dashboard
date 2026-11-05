import { Schema, type SchemaDefinition, type SchemaOptions } from 'mongoose';

/** Fields that must never leave the database layer, even through accidental toJSON(). */
const HIDDEN_FIELDS = ['passwordHash', 'refreshTokenHash', 'previousRefreshTokenHash', 'tokenHash'];

export interface BaseSchemaOptions {
  timestamps?: SchemaOptions['timestamps'];
  minimize?: boolean;
}

/**
 * Creates a schema with the platform's base conventions:
 * - `createdAt` / `updatedAt` timestamps.
 * - Strict mode (unknown paths are dropped).
 * - Safe JSON serialization: `id` instead of `_id`, no `__v`, hidden secret fields.
 *
 * API responses are built with explicit DTO mappers; the JSON transform is a safety net.
 */
export function createSchema<T>(definition: SchemaDefinition<T>, options: BaseSchemaOptions = {}): Schema<T> {
  const schema = new Schema<T>(definition, { timestamps: true, strict: true, ...options });
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      for (const field of HIDDEN_FIELDS) delete ret[field];
      return ret;
    },
  });
  return schema;
}
