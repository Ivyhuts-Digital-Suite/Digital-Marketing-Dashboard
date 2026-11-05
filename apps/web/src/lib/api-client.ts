import { API_PREFIX, ORGANIZATION_HEADER, type ErrorCode } from '@mp/shared';
import type { ApiMeta, ApiResponse, ValidationIssue } from '@mp/types';

/** Error thrown for any non-2xx API response, carrying the API's error envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly details: ValidationIssue[];
  readonly requestId: string | undefined;

  constructor(status: number, code: ApiError['code'], message: string, details: ValidationIssue[] = [], requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** Field errors keyed by field name (`body.email` → `email`). */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((d) => [d.path.replace(/^(body|query|params)\./, ''), d.message]));
  }
}

export const SESSION_EXPIRED_EVENT = 'mp:session-expired';

/** Endpoints whose 401s are a real answer, never a reason to refresh. */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

let refreshInFlight: Promise<boolean> | null = null;

/** Single-flight refresh: concurrent 401s share one refresh request (avoids rotation races). */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${API_PREFIX}/auth/refresh`, { method: 'POST', credentials: 'same-origin' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  organizationId?: string | null;
  signal?: AbortSignal;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.organizationId) headers[ORGANIZATION_HEADER] = options.organizationId;
  try {
    return await fetch(`${API_PREFIX}${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.');
  }
}

async function parse<T>(res: Response): Promise<{ data: T; meta?: ApiMeta }> {
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (res.ok && body?.success) return { data: body.data, ...(body.meta && { meta: body.meta }) };
  if (body && !body.success) {
    const { code, message, details, requestId } = body.error;
    throw new ApiError(res.status, code, message, details, requestId);
  }
  throw new ApiError(res.status, 'INTERNAL_ERROR', 'Unexpected response from the server.');
}

/**
 * Typed API request through the same-origin `/api` proxy. On an authentication failure it
 * refreshes the session once and retries; if that fails it announces session expiry.
 */
export async function apiRequestWithMeta<T>(path: string, options: RequestOptions = {}): Promise<{ data: T; meta?: ApiMeta }> {
  let res = await send(path, options);

  if (res.status === 401 && !NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
    if (await refreshSession()) {
      res = await send(path, options);
    }
    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
  }
  return parse<T>(res);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiRequestWithMeta<T>(path, options)).data;
}
