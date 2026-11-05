import { Redis } from 'ioredis';
import type { Logger } from './logger';

/**
 * Creates an ioredis connection. `maxRetriesPerRequest: null` is required by BullMQ workers.
 * The connection is lazy so the caller controls when (and whether) to connect.
 */
export function createRedisConnection(url: string, logger: Logger, name = 'api'): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectionName: `marketing-platform-${name}`,
    retryStrategy: (attempt) => Math.min(attempt * 500, 10_000),
  });
  // Error objects can include the host; never the password, but keep logs concise anyway.
  client.on('error', (error: Error) => logger.warn({ err: { message: error.message } }, 'Redis error'));
  client.on('ready', () => logger.info({ name }, 'Redis ready'));
  return client;
}

export async function connectRedis(client: Redis, timeoutMs = 5_000): Promise<void> {
  await Promise.race([
    client.connect(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timed out')), timeoutMs)),
  ]);
}

export async function checkRedis(
  client: Redis | undefined,
  timeoutMs = 1_000,
): Promise<{ status: 'up' | 'down' | 'not_configured'; latencyMs?: number }> {
  if (!client) return { status: 'not_configured' };
  if (client.status !== 'ready') return { status: 'down' };
  const started = performance.now();
  try {
    await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), timeoutMs)),
    ]);
    return { status: 'up', latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { status: 'down' };
  }
}
