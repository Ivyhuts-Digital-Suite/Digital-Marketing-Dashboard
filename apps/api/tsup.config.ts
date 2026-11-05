import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/worker.ts', 'src/scripts/sync-indexes.ts', 'src/scripts/grant-super-admin.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: true,
  // Workspace packages ship TypeScript source, so they are bundled; npm dependencies stay external.
  noExternal: [/^@mp\//],
});
