import argon2 from 'argon2';

/**
 * Argon2id with OWASP-recommended minimum parameters (19 MiB memory, 2 iterations,
 * 1 lane). Parameters are encoded in each hash, so they can be raised later and old
 * hashes are upgraded transparently at next sign-in (see needsRehash).
 */
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, HASH_OPTIONS);
}

let dummyHash: Promise<string> | undefined;

/**
 * Burns comparable CPU time when the account does not exist, so response timing does not
 * reveal which email addresses are registered.
 */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('dummy-password-for-timing-equalization');
  await verifyPassword(await dummyHash, password);
}
