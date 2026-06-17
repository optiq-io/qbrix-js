export class QbrixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    // keep instanceof working when consumers downlevel below es2015
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class QbrixAPIError extends QbrixError {
  readonly status: number;
  readonly detail: string;
  readonly context: Record<string, unknown> | undefined;

  constructor(status: number, detail: string, context?: Record<string, unknown>) {
    super(`[${status}] ${detail}`);
    this.status = status;
    this.detail = detail;
    this.context = context;
  }
}

export class BadRequestError extends QbrixAPIError {}
export class AuthenticationError extends QbrixAPIError {}
export class ForbiddenError extends QbrixAPIError {}
export class NotFoundError extends QbrixAPIError {}
export class ConflictError extends QbrixAPIError {}

export class RateLimitedError extends QbrixAPIError {
  readonly retryAfter: number | undefined;

  constructor(
    status: number,
    detail: string,
    context?: Record<string, unknown>,
    retryAfter?: number,
  ) {
    super(status, detail, context);
    this.retryAfter = retryAfter;
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
  context?: Record<string, unknown>,
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
