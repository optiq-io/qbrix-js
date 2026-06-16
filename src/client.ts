/**
 * public client surface. configuration resolution and auth headers land in
 * OPT-130; select()/feedback() in OPT-38. this scaffold only holds options.
 */

export interface QbrixClientOptions {
  /** qbrix api key (prefix `optiq_`). falls back to `QBRIX_API_KEY`. */
  apiKey?: string;
  /** base url of the qbrix proxy. defaults to `http://localhost:8080`. */
  baseUrl?: string;
  /** request timeout in milliseconds. defaults to 30000. */
  timeout?: number;
  /** max retry attempts on retryable status codes. defaults to 2. */
  maxRetries?: number;
  /** status codes to retry. defaults to [429, 502, 503, 504]. */
  retryOn?: number[];
  /** custom fetch implementation, injectable for tests and custom runtimes. */
  fetch?: typeof fetch;
  /** extra headers merged into every request. */
  headers?: Record<string, string>;
}

export class QbrixClient {
  readonly options: QbrixClientOptions;

  constructor(options: QbrixClientOptions = {}) {
    this.options = options;
  }
}
