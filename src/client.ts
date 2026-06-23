import type { ResolvedConfig } from "./config";
import { resolveConfig } from "./config";
import { QbrixError } from "./errors";
import type { components } from "./generated";
import type { LogLevel, QbrixLogger } from "./logger";
import { fromSelectResponse, toFeedbackRequest, toSelectRequest } from "./mapper";
import { request } from "./transport";
import type { Context, SelectResult } from "./types";
import { VERSION } from "./version";

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

  async select(experimentId: string, context: Context): Promise<SelectResult> {
    const body = toSelectRequest({ experimentId, context });
    const wire = await request<components["schemas"]["AgentSelectResponse"]>(
      this.config,
      "POST",
      "/api/v1/agent/select",
      { body },
    );
    if (wire === undefined) {
      throw new QbrixError("qbrix: select returned no response body");
    }
    return fromSelectResponse(wire);
  }

  async feedback(requestId: string, reward: number): Promise<void> {
    const body = toFeedbackRequest({ requestId, reward });
    await request(this.config, "POST", "/api/v1/agent/feedback", { body });
  }
}
