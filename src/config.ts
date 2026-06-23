import type { QbrixClientOptions } from "./client";
import type { QbrixLogger } from "./logger";

export interface ResolvedConfig {
  apiKey: string | undefined;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryOn: number[];
  fetch: typeof fetch | undefined;
  headers: Record<string, string>;
  logger: QbrixLogger | undefined;
}

// todo: check the defaults / might want to add the hosted url here / update the timeout to be low latency etc.
const DEFAULTS = {
  baseUrl: "http://localhost:8080",
  timeout: 30_000,
  maxRetries: 2,
  retryOn: [429, 502, 503, 504] as number[],
};

// guarded globalThis access keeps the browser bundle clean and avoids needing `@types/node`
function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.[name];
}

// precedence per option: explicit arg → env var → default
export function resolveConfig(options: QbrixClientOptions = {}): ResolvedConfig {
  const config: ResolvedConfig = {
    apiKey: options.apiKey ?? readEnv("QBRIX_API_KEY"),
    baseUrl: options.baseUrl ?? readEnv("QBRIX_BASE_URL") ?? DEFAULTS.baseUrl,
    timeout: options.timeout ?? DEFAULTS.timeout,
    maxRetries: options.maxRetries ?? DEFAULTS.maxRetries,
    retryOn: options.retryOn ?? [...DEFAULTS.retryOn],
    fetch: options.fetch,
    headers: options.headers ?? {},
    logger: options.logger,
  };

  if (config.timeout <= 0) {
    throw new Error(`qbrix: timeout must be > 0, got ${config.timeout}`);
  }
  if (config.maxRetries < 0) {
    throw new Error(`qbrix: maxRetries must be >= 0, got ${config.maxRetries}`);
  }

  return config;
}
