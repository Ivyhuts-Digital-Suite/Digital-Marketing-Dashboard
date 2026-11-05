import type { Redis } from 'ioredis';
import type { ServerConfig } from './config';
import type { Logger } from './lib/logger';
import type { Mailer } from './lib/mailer';
import type { QueueRegistry } from './queues';
import { AuditService } from './modules/audit/audit.service';
import { TokenService } from './modules/auth/token.service';
import { createMailer } from './lib/mailer';

/**
 * Process-wide dependencies shared by routers and services. Built once at startup (or per
 * test) and passed explicitly, which keeps modules testable without global singletons.
 */
export interface AppContext {
  config: ServerConfig;
  logger: Logger;
  redis: Redis | undefined;
  queues: QueueRegistry | undefined;
  mailer: Mailer;
  tokens: TokenService;
  audit: AuditService;
}

export function createAppContext(options: {
  config: ServerConfig;
  logger: Logger;
  redis?: Redis | undefined;
  queues?: QueueRegistry | undefined;
  mailer?: Mailer;
}): AppContext {
  const { config, logger, redis, queues } = options;
  return {
    config,
    logger,
    redis,
    queues,
    mailer: options.mailer ?? createMailer(config, logger, queues),
    tokens: new TokenService(config),
    audit: new AuditService(logger),
  };
}
