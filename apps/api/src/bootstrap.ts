import type { Redis } from 'ioredis';
import { createAppContext, type AppContext } from './app-context';
import type { ServerConfig } from './config';
import { connectDatabase, disconnectDatabase } from './lib/database';
import { createLogger, type Logger } from './lib/logger';
import { connectRedis, createRedisConnection } from './lib/redis';
import { createQueues, type QueueRegistry } from './queues';

export interface Runtime {
  ctx: AppContext;
  shutdown(signal: string): Promise<void>;
}

/**
 * Connects infrastructure for a process (API server or worker). MongoDB is required and
 * fails startup; Redis is optional, and a configured-but-unreachable Redis also fails
 * startup, because silently dropping background jobs would be worse than not starting.
 */
export async function bootstrap(config: ServerConfig, name: 'api' | 'worker'): Promise<Runtime> {
  const logger: Logger = createLogger({
    level: config.logLevel,
    pretty: config.env === 'development',
    name,
  });

  await connectDatabase({
    uri: config.database.uri,
    dbName: config.database.dbName,
    autoIndex: !config.isProduction,
    logger,
  });

  let redis: Redis | undefined;
  let queues: QueueRegistry | undefined;
  if (config.redis.url) {
    redis = createRedisConnection(config.redis.url, logger, name);
    await connectRedis(redis);
    queues = createQueues(redis);
  } else {
    logger.warn('REDIS_URL not set: background queues disabled, rate limits are per-process');
  }

  const ctx = createAppContext({ config, logger, redis, queues });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    await queues?.close().catch((err: unknown) => logger.error({ err }, 'Error closing queues'));
    await redis?.quit().catch((err: unknown) => logger.error({ err }, 'Error closing Redis'));
    await disconnectDatabase().catch((err: unknown) => logger.error({ err }, 'Error closing MongoDB'));
  };

  return { ctx, shutdown };
}

/** Installs signal and fatal-error handlers that run `close` once, then exit. */
export function handleProcessSignals(logger: Logger, close: (signal: string) => Promise<void>): void {
  let closing = false;
  const run = (signal: string, code: number) => {
    if (closing) return;
    closing = true;
    const timer = setTimeout(() => {
      logger.error('Graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, 15_000);
    timer.unref();
    close(signal)
      .catch((err: unknown) => logger.error({ err }, 'Error during shutdown'))
      .finally(() => process.exit(code));
  };

  process.on('SIGINT', () => run('SIGINT', 0));
  process.on('SIGTERM', () => run('SIGTERM', 0));
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    run('unhandledRejection', 1);
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    run('uncaughtException', 1);
  });
}
