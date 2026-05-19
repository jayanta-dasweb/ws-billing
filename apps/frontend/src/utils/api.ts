import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number | string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function messageFromBody(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  const msg = body.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (Array.isArray(msg) && msg.length > 0) {
    return msg.filter((x): x is string => typeof x === 'string').join(', ');
  }
  return undefined;
}

/** API rejected changes because the bill is no longer open. */
export function isBillClosedError(message: string): boolean {
  return /cancelled|cannot be edited|completed|not found|no longer open/i.test(message);
}

/** Stock reservation could not increase qty (pool exhausted). */
export function isInsufficientStockError(message: string): boolean {
  return /insufficient stock/i.test(message);
}

export function parseInsufficientStockAvailable(message: string): number | null {
  const m = message.match(/available\s+([\d.]+)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Turn RTK Query / fetch failures into a user-readable string. */
export function getApiErrorMessage(err: unknown, fallback = 'Request failed'): string {
  if (typeof err === 'string' && err.trim()) return err;
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;

  if (isRecord(err)) {
    const fromData = messageFromBody(err.data);
    if (fromData) return fromData;

    const fromError = messageFromBody(err.error);
    if (fromError) return fromError;

    if (typeof err.status === 'number' || typeof err.status === 'string') {
      const statusMsg = messageFromBody(err);
      if (statusMsg) return statusMsg;
      if (err.status === 'FETCH_ERROR') {
        return 'Cannot reach the server. Run npm run dev (backend on port 4000 + frontend on 3000).';
      }
      if (err.status === 'PARSING_ERROR') {
        return 'Server returned a non-JSON response (API may be stopped or proxy failed). Run npm run dev from the project root, wait for both servers, then refresh.';
      }
      return `Request failed (${err.status})`;
    }
  }

  return fallback;
}

export function unwrapApi<T>(body: unknown): T {
  const envelope = body as ApiEnvelope<T>;
  if (!isRecord(envelope)) {
    throw new ApiError('Invalid API response');
  }
  if (envelope.success === false) {
    throw new ApiError(messageFromBody(envelope) ?? 'Request failed');
  }
  if (envelope.data === undefined) {
    throw new ApiError('Invalid API response: missing data');
  }
  return envelope.data;
}

export function isFetchBaseQueryError(err: unknown): err is FetchBaseQueryError {
  return isRecord(err) && 'status' in err;
}
