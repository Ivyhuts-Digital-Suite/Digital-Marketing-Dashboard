import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { pinoHttp } from 'pino-http';
import { REQUEST_ID_HEADER } from '@mp/shared';
import type { Logger } from '../lib/logger';

const INCOMING_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Assigns a request ID (reusing a well-formed upstream one) and echoes it in the response. */
export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get(REQUEST_ID_HEADER);
    req.id = incoming && INCOMING_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader(REQUEST_ID_HEADER, String(req.id));
    next();
  };
}

/** Structured access log. Authorization headers and cookies are redacted by the logger. */
export function requestLogger(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customLogLevel: (req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return req.url?.includes('/health') ? 'debug' : 'info';
    },
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url.split('?')[0],
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}
