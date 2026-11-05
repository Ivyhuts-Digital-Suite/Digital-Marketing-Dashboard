import { emailSchema } from '@mp/validators';
import { loadConfigOrExit } from '../config';
import { connectDatabase, disconnectDatabase } from '../lib/database';
import { createLogger } from '../lib/logger';
import { UserModel } from '../modules/users/user.model';

/**
 * Grants (or with --revoke, removes) the platform SUPER_ADMIN role. Deliberately an
 * operator-only CLI: no API endpoint can grant platform roles.
 *
 *   npm run user:grant-super-admin -w @mp/api -- someone@example.com [--revoke]
 */
async function main() {
  const args = process.argv.slice(2);
  const parsed = emailSchema.safeParse(args.find((arg) => !arg.startsWith('--')));
  if (!parsed.success) {
    console.error('Usage: grant-super-admin <email> [--revoke]');
    process.exit(1);
  }
  const revoke = args.includes('--revoke');

  const config = loadConfigOrExit();
  const logger = createLogger({ level: 'info', name: 'grant-super-admin' });
  await connectDatabase({ uri: config.database.uri, dbName: config.database.dbName, autoIndex: false, logger });

  const result = await UserModel.updateOne(
    { email: parsed.data },
    { $set: { platformRole: revoke ? 'USER' : 'SUPER_ADMIN' } },
  );
  logger.info({ matched: result.matchedCount, modified: result.modifiedCount }, revoke ? 'Revoked' : 'Granted');
  await disconnectDatabase();
  if (result.matchedCount === 0) process.exit(2);
}

main().catch((error: unknown) => {
  console.error(`[grant-super-admin] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
