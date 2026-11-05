import mongoose from 'mongoose';
import { loadConfigOrExit } from '../config';
import { connectDatabase, disconnectDatabase } from '../lib/database';
import { createLogger } from '../lib/logger';
import '../models';

/**
 * Creates/updates indexes for every model. Production runs with autoIndex disabled, so
 * run this as a deployment step whenever a schema's indexes change.
 */
async function main() {
  const config = loadConfigOrExit();
  const logger = createLogger({ level: 'info', name: 'sync-indexes' });
  await connectDatabase({ uri: config.database.uri, dbName: config.database.dbName, autoIndex: false, logger });
  for (const name of mongoose.modelNames()) {
    const dropped = await mongoose.model(name).syncIndexes();
    logger.info({ model: name, dropped }, 'Indexes synchronized');
  }
  await disconnectDatabase();
}

main().catch((error: unknown) => {
  console.error(`[sync-indexes] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
