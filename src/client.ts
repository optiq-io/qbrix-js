import type { ResolvedConfig } from "./config";
import { resolveConfig } from "./config";
import { VERSION } from "./version";

export interface QbrixClientOptions {
  /** qbrix api key (prefix `optiq_`). falls back to `QBRIX_API_KEY`. */
  apiKey?: string;
  /** base url of the qbrix proxy. falls back to `QBRIX_BASE_URL`, then `http://localhost:8080`. */
  baseUrl?: string;
  /** request timeout in milliseconds. defaults to 30000. */
  timeout?: number;
  /** max retry attempts on retryable status codes. defaults to 2. */
  maxRetries?: number;
  /** status codes to retry. defaults to [429, 502, 503, 504]. */
  retryOn?: number[];
  /** custom fetch implementation, injectable for tests and custom runtimes. */
  fetch?: typeof fetch;
  /** extra headers merged into every request (override the defaults). */
  headers?: Record<string, string>;
}

/**
 * build the request headers for a resolved config.
 *
 * the `User-Agent` is only set off-browser — browsers forbid setting it and
 * silently drop or error on the attempt. user-supplied headers win.
 */
export function buildHeaders(config: ResolvedConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["X-API-Key"] = config.apiKey;
  }
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
