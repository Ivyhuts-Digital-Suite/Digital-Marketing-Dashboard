import { z } from 'zod';

/**
 * Environment used by the Next.js server (rewrites, server components).
 * API_URL is server-only; it is never exposed to the browser bundle.
 */
const webServerEnvSchema = z.object({
  API_URL: z.url().default('http://localhost:4000'),
});

/** Only NEXT_PUBLIC_* values may be read by browser code. Never place secrets here. */
const webPublicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('Marketing Platform'),
});

export type WebServerEnv = z.infer<typeof webServerEnvSchema>;
export type WebPublicEnv = z.infer<typeof webPublicEnvSchema>;

function emptyToUndefined(source: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value?.trim() === '' ? undefined : value]),
  );
}

export function loadWebServerEnv(source: Record<string, string | undefined> = process.env): WebServerEnv {
  const result = webServerEnvSchema.safeParse(emptyToUndefined(source));
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid web environment configuration: ${names}`);
  }
  return result.data;
}

export function loadWebPublicEnv(source: Record<string, string | undefined>): WebPublicEnv {
  return webPublicEnvSchema.parse(emptyToUndefined(source));
}
