import type { QbrixClientOptions } from "./client";

/** fully-resolved client configuration with all defaults applied. */
export interface ResolvedConfig {
  apiKey: string | undefined;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryOn: number[];
  fetch: typeof fetch | undefined;
  headers: Record<string, string>;
}

const DEFAULTS = {
  baseUrl: "http://localhost:8080",
  timeout: 30_000,
  maxRetries: 2,
  retryOn: [429, 502, 503, 504] as number[],
};

/**
 * read an env var via globalThis, guarded so the browser bundle stays clean
 * and the SDK needs no `@types/node` (keeps the isomorphic discipline honest).
 */
function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.[name];
}

/**
 * resolve client options into a fully-defaulted config.
 *
 * precedence per option: explicit arg → env var → default.
 * env vars apply to `apiKey` (QBRIX_API_KEY) and `baseUrl` (QBRIX_BASE_URL).
 */
export function resolveConfig(options: QbrixClientOptions = {}): ResolvedConfig {
  const config: ResolvedConfig = {
    apiKey: options.apiKey ?? readEnv("QBRIX_API_KEY"),
    baseUrl: options.baseUrl ?? readEnv("QBRIX_BASE_URL") ?? DEFAULTS.baseUrl,
    timeout: options.timeout ?? DEFAULTS.timeout,
    maxRetries: options.maxRetries ?? DEFAULTS.maxRetries,
    retryOn: options.retryOn ?? [...DEFAULTS.retryOn],
    fetch: options.fetch,
    headers: options.headers ?? {},
  };

  if (config.timeout <= 0) {
    throw new Error(`qbrix: timeout must be > 0, got ${config.timeout}`);
  }
  if (config.maxRetries < 0) {
    throw new Error(`qbrix: maxRetries must be >= 0, got ${config.maxRetries}`);
  }

  return config;
}
