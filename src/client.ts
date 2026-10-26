import type { ResolvedConfig } from "./config";
import { resolveConfig } from "./config";
import {
  BadGatewayError,
  GatewayTimeoutError,
  InternalServerError,
  QbrixConnectionError,
  QbrixError,
  QbrixTimeoutError,
  RateLimitedError,
  ServiceUnavailableError,
} from "./errors";
import type { components } from "./generated";
import type { LogLevel, QbrixLogger } from "./logger";
import {
  fromOutcomeResponse,
  fromSelectResponse,
  toOutcomeRequest,
  toSelectRequest,
} from "./mapper";
import { request } from "./transport";
import type { Context, Decision, Outcome, OutcomeOptions, Settings } from "./types";
import { VERSION } from "./version";

// failures that mean "qbrix is unreachable or unhealthy right now", as opposed to a
// caller error (bad request, auth, unknown loop, ...). select() answers offline only
// for these — never for errors that indicate the request itself was wrong, since
// silently swallowing those would hide real bugs behind a fabricated decision.
const AVAILABILITY_ERRORS = [
  QbrixConnectionError,
  QbrixTimeoutError,
  RateLimitedError,
  InternalServerError,
  BadGatewayError,
  ServiceUnavailableError,
  GatewayTimeoutError,
];

function isAvailabilityError(err: unknown): boolean {
  return AVAILABILITY_ERRORS.some((ErrorClass) => err instanceof ErrorClass);
}

export interface QbrixOptions {
  /** qbrix api key (prefix `optiq_`). falls back to `QBRIX_API_KEY`. */
  apiKey?: string;
  /** base url of your qbrix install. falls back to `QBRIX_BASE_URL`. */
  baseUrl?: string;
  /** request timeout in milliseconds. */
  timeout?: number;
  /** max retry attempts on retryable status codes. */
  maxRetries?: number;
  /** status codes to retry. */
  retryOn?: number[];
  /** custom fetch implementation, injectable for tests and custom runtimes. */
  fetch?: typeof fetch;
  /** extra headers merged into every request; user headers override the defaults. */
  headers?: Record<string, string>;
  /** optional log sink; never receives secrets. defaults to a console sink when a level is active. */
  logger?: QbrixLogger;
  /** logging verbosity. defaults to "off" (silent); also read from QBRIX_LOG / QBRIX_DEBUG. */
  logLevel?: LogLevel;
}

export function buildHeaders(config: ResolvedConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["X-API-Key"] = config.apiKey;
  }
  // browsers forbid setting User-Agent and drop or error on the attempt
  if (typeof document === "undefined") {
    headers["User-Agent"] = `qbrix-js/${VERSION}`;
  }
  return { ...headers, ...config.headers };
}

export class Qbrix {
  readonly config: ResolvedConfig;

  constructor(options: QbrixOptions = {}) {
    this.config = resolveConfig(options);
  }

  async select(loop: string, context: Context, settings: Settings = {}): Promise<Decision> {
    const body = toSelectRequest(loop, context);
    try {
      const wire = await request<components["schemas"]["SelectResponse"]>(
        this.config,
        "POST",
        "/api/v1/select",
        { body, timeout: settings.timeout, maxRetries: settings.maxRetries },
      );
      if (wire === undefined) {
        throw new QbrixError("qbrix: select returned no response body");
      }
      return fromSelectResponse(wire);
    } catch (err) {
      if (isAvailabilityError(err)) {
        return { option: settings.offline ?? null, requestId: null, reason: "offline" };
      }
      throw err;
    }
  }

  async outcome(
    requestId: string | null,
    value: number,
    options: OutcomeOptions = {},
  ): Promise<Outcome | null> {
    if (!requestId) return null;
    // minted once per call, so every retry of this call counts once on the server
    const id = options.id ?? crypto.randomUUID();
    const body = toOutcomeRequest(requestId, value, id, options.at);
    const wire = await request<components["schemas"]["OutcomeResponse"]>(
      this.config,
      "POST",
      "/api/v1/outcome",
      { body, timeout: options.timeout, maxRetries: options.maxRetries },
    );
    if (wire === undefined) {
      throw new QbrixError("qbrix: outcome returned no response body");
    }
    return fromOutcomeResponse(wire);
  }
}
