import type { Server } from 'node:http';
import { createApp } from './app';
import { bootstrap, handleProcessSignals } from './bootstrap';
import { loadConfigOrExit } from './config';

async function main() {
  const config = loadConfigOrExit();
  const { ctx, shutdown } = await bootstrap(config, 'api');
  const app = createApp(ctx);

  const server: Server = app.listen(config.api.port, () => {
    ctx.logger.info({ port: config.api.port, env: config.env }, `API listening on ${config.api.url}`);
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  handleProcessSignals(ctx.logger, async (signal) => {
    // Stop accepting connections, let in-flight requests finish, then close dependencies.
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await shutdown(signal);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[api] Failed to start: ${message}`);
  process.exit(1);
});
