import type { ErrorCode } from '@mp/shared';

/** Successful API response envelope. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  /** Field-level problems for VALIDATION_ERROR responses. */
  details?: ValidationIssue[];
  requestId?: string;
}

/** Failed API response envelope. */
export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface ValidationIssue {
  /** Dot-separated location, prefixed by the request part: `body.email`, `query.limit`. */
  path: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiMeta {
  pagination?: PaginationMeta;
}

export type DependencyStatus = 'up' | 'down' | 'not_configured';

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  checks: {
    mongodb: { status: DependencyStatus; latencyMs?: number };
    redis: { status: DependencyStatus; latencyMs?: number };
  };
}
