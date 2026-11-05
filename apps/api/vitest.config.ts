import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup-env.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Each file connects to its own database on the shared in-memory server.
    fileParallelism: true,
  },
});
