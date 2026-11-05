import mongoose from 'mongoose';
import type { Logger } from './logger';

mongoose.set('strictQuery', true);

export interface DatabaseOptions {
  uri: string;
  dbName?: string | undefined;
  autoIndex: boolean;
  logger: Logger;
  serverSelectionTimeoutMS?: number;
}

let listenersAttached = false;

function attachListeners(logger: Logger) {
  if (listenersAttached) return;
  listenersAttached = true;
  const { connection } = mongoose;
  connection.on('connected', () => logger.info({ db: connection.name }, 'MongoDB connected'));
  connection.on('reconnected', () => logger.warn('MongoDB reconnected'));
  connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  // Driver errors may embed the connection string; log only the message class.
  connection.on('error', (error: Error) => logger.error({ err: { name: error.name, message: error.message } }, 'MongoDB error'));
}

/** Opens the shared Mongoose connection. Throws if the server cannot be reached. */
export async function connectDatabase(options: DatabaseOptions): Promise<typeof mongoose> {
  attachListeners(options.logger);
  return mongoose.connect(options.uri, {
    ...(options.dbName && { dbName: options.dbName }),
    autoIndex: options.autoIndex,
    serverSelectionTimeoutMS: options.serverSelectionTimeoutMS ?? 10_000,
    maxPoolSize: 20,
    appName: 'marketing-platform-api',
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

/** Pings the primary. Used by the readiness endpoint. */
export async function checkDatabase(timeoutMs = 2_000): Promise<{ status: 'up' | 'down'; latencyMs?: number }> {
  const db = mongoose.connection.db;
  if (!db || !isDatabaseConnected()) return { status: 'down' };
  const started = performance.now();
  try {
    await Promise.race([
      db.admin().ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), timeoutMs)),
    ]);
    return { status: 'up', latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { status: 'down' };
  }
}
