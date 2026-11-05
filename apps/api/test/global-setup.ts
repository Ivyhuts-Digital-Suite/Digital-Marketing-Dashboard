import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/**
 * Starts one real `mongod` for the whole test run (each test file uses its own database).
 *
 * - TEST_MONGODB_URI: use an existing MongoDB server instead.
 * - MONGOMS_SYSTEM_BINARY: path to a locally installed mongod (skips the binary download).
 */
export default async function setup(project: TestProject) {
  if (process.env.TEST_MONGODB_URI) {
    project.provide('mongoUri', process.env.TEST_MONGODB_URI);
    return;
  }
  const server = await MongoMemoryServer.create();
  project.provide('mongoUri', server.getUri());
  return async () => {
    await server.stop();
  };
}
