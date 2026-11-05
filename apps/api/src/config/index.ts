import { existsSync } from 'node:fs';
import path from 'node:path';
import { EnvValidationError, loadServerConfig, type ServerConfig } from '@mp/config/server-env';

export type { ServerConfig };

/**
 * Loads the monorepo-root `.env` (or one in the current directory) into process.env.
 * Variables already present in the real environment take precedence over the file.
 */
export function loadEnvFile(): string | undefined {
  const candidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (file) process.loadEnvFile(file);
  return file;
}

/**
 * Loads and validates configuration, exiting the process with a safe, value-free message
 * when it is invalid. Used by process entry points only; tests call loadServerConfig directly.
 */
export function loadConfigOrExit(): ServerConfig {
  loadEnvFile();
  try {
    return loadServerConfig(process.env);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(`\n[config] ${error.message}\n\nSee docs/ENVIRONMENT_VARIABLES.md and .env.example.\n`);
      process.exit(1);
    }
    throw error;
  }
}
