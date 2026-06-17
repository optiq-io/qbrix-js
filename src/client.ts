import type { ResolvedConfig } from "./config";
import { resolveConfig } from "./config";
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
}
