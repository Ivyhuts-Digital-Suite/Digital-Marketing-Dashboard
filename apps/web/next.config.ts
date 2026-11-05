import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import type { NextConfig } from 'next';
import { loadWebServerEnv } from '@mp/config/web-env';

const repoRoot = path.resolve(process.cwd(), '../..');

/**
 * The monorepo keeps a single root `.env`. Only the variables the web server needs
 * (API_URL and NEXT_PUBLIC_*) are read from it, so backend secrets never enter the
 * Next.js process, let alone the browser bundle.
 */
function readRootWebEnv(): Record<string, string> {
  const file = path.join(repoRoot, '.env');
  if (!existsSync(file)) return {};
  const parsed = parseEnv(readFileSync(file, 'utf8')) as Record<string, string>;
  return Object.fromEntries(Object.entries(parsed).filter(([key]) => key === 'API_URL' || key.startsWith('NEXT_PUBLIC_')));
}

const rootEnv = readRootWebEnv();
for (const [key, value] of Object.entries(rootEnv)) process.env[key] ??= value;
const { API_URL } = loadWebServerEnv(process.env);

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@mp/shared', '@mp/types', '@mp/validators', '@mp/config'],
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  env: { NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? 'Marketing Platform' },
  /**
   * The browser talks to the API through this same-origin proxy, so auth cookies are
   * first-party for the web origin and no CORS round-trips are needed.
   */
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
