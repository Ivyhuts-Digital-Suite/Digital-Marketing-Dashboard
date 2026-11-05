/**
 * Recursively replaces values whose keys look sensitive. Used for audit metadata and any
 * structured data that may be persisted or logged. Matching is by key name, so callers
 * must not smuggle secrets under innocuous keys.
 */
const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|cookie|api[-_]?key|credential|private[-_]?key|session[-_]?id|otp|hash/i;

export const REDACTED = '[REDACTED]';

const MAX_DEPTH = 8;

export function redactSensitive<T>(value: T, depth = 0): T {
  if (depth > MAX_DEPTH) return '[TRUNCATED]' as T;
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1)) as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(nested, depth + 1);
    }
    return output as T;
  }
  return value;
}

/** Pino redaction paths for request/response logging. */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.apiKey',
];
