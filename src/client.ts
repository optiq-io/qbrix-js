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
import { fromSelectResponse, toFeedbackRequest, toSelectRequest } from "./mapper";
import { request } from "./transport";
import type { Context, FeedbackOptions, SelectOptions, SelectResult } from "./types";
import { VERSION } from "./version";

// failures that mean "the proxy is unreachable or unhealthy right now", as opposed
// to a caller error (bad request, auth, not found, ...). select() only falls back
// to a caller-declared arm for these — never for errors that indicate the request
// itself was wrong, since silently swallowing those would hide real bugs behind a
// fabricated selection.
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

export interface QbrixClientOptions {
  /** qbrix api key (prefix `optiq_`). falls back to `QBRIX_API_KEY`. */
  apiKey?: string;
  /** base url of the qbrix proxy. falls back to `QBRIX_BASE_URL`. */
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

export class QbrixClient {
  readonly config: ResolvedConfig;

  constructor(options: QbrixClientOptions = {}) {
    this.config = resolveConfig(options);
  }

  async select(
    experimentId: string,
    context: Context,
    options: SelectOptions = {},
  ): Promise<SelectResult> {
    const body = toSelectRequest({ experimentId, context });
    try {
      const wire = await request<components["schemas"]["AgentSelectResponse"]>(
        this.config,
        "POST",
        "/api/v1/agent/select",
        { body, timeout: options.timeout, maxRetries: options.maxRetries },
      );
      if (wire === undefined) {
        throw new QbrixError("qbrix: select returned no response body");
      }
      return fromSelectResponse(wire);
    } catch (err) {
      if (options.fallback && isAvailabilityError(err)) {
        // no server-minted token exists for a locally-resolved fallback, so
        // feedback() must not send one — mirrors the proxy's own paused-experiment
        // response, where request_id is also null.
        return {
          arm: options.fallback,
          requestId: null,
          isDefault: true,
          isFallback: true,
        };
      }
      throw err;
    }
  }

  async feedback(
    requestId: string | null,
    reward: number,
    options: FeedbackOptions = {},
  ): Promise<void> {
    // a null requestId means select() minted no token — a paused experiment, or a
    // client-side fallback. nothing valid to feed back.
    if (!requestId) return;
    const body = toFeedbackRequest({ requestId, reward });
    await request(this.config, "POST", "/api/v1/agent/feedback", {
      body,
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });
  }
}
