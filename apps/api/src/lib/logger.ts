import { pino, type Logger, type LoggerOptions } from 'pino';
import { LOG_REDACT_PATHS } from './redact';

export type { Logger };

export function createLogger(options: { level: string; pretty?: boolean; name?: string }): Logger {
  const config: LoggerOptions = {
    name: options.name ?? 'api',
    level: options.level,
    redact: { paths: LOG_REDACT_PATHS, censor: '[REDACTED]' },
    base: { service: options.name ?? 'api' },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  if (options.pretty) {
    config.transport = { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } };
  }
  return pino(config);
}
