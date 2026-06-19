import type { ErrorCode } from "./types";

export class QbrixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    // keep instanceof working when consumers downlevel below es2015
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// `string & {}` keeps autocomplete of the known codes while tolerating codes a
// newer backend may send before the sdk's generated union catches up.
interface ApiErrorOptions {
  code?: ErrorCode | (string & {});
  context?: Record<string, unknown>;
}

export class QbrixAPIError extends QbrixError {
  readonly status: number;
  readonly detail: string;
  readonly code: ErrorCode | (string & {}) | undefined;
  readonly context: Record<string, unknown> | undefined;

  constructor(status: number, detail: string, options?: ApiErrorOptions) {
    super(`[${status}] ${detail}`);
    this.status = status;
    this.detail = detail;
    this.code = options?.code;
    this.context = options?.context;
  }
}

export class BadRequestError extends QbrixAPIError {}
export class AuthenticationError extends QbrixAPIError {}
export class ForbiddenError extends QbrixAPIError {}
export class NotFoundError extends QbrixAPIError {}
export class ConflictError extends QbrixAPIError {}

interface RateLimitedErrorOptions extends ApiErrorOptions {
  retryAfter?: number;
}

export class RateLimitedError extends QbrixAPIError {
  readonly retryAfter: number | undefined;

  constructor(status: number, detail: string, options?: RateLimitedErrorOptions) {
    super(status, detail, options);
    this.retryAfter = options?.retryAfter;
  }
}

export class InternalServerError extends QbrixAPIError {}
export class BadGatewayError extends QbrixAPIError {}
export class ServiceUnavailableError extends QbrixAPIError {}
export class GatewayTimeoutError extends QbrixAPIError {}

export class QbrixConnectionError extends QbrixError {}
export class QbrixTimeoutError extends QbrixError {}

type ApiErrorConstructor = new (
  status: number,
  detail: string,
  options?: ApiErrorOptions,
) => QbrixAPIError;

export const STATUS_TO_ERROR: Record<number, ApiErrorConstructor> = {
  400: BadRequestError,
  401: AuthenticationError,
  403: ForbiddenError,
  404: NotFoundError,
  409: ConflictError,
  429: RateLimitedError,
  500: InternalServerError,
  502: BadGatewayError,
  503: ServiceUnavailableError,
  504: GatewayTimeoutError,
};
