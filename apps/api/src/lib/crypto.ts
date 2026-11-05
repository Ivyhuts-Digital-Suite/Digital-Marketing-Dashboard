import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Cryptographically random URL-safe token (default 256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 hex digest. Used to store one-time tokens and refresh-token IDs without keeping usable values. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
