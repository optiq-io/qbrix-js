import type { QbrixClientOptions } from "./client";
import { type LogLevel, type QbrixLogger, consoleLogger } from "./logger";

export interface ResolvedConfig {
  apiKey: string | undefined;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryOn: number[];
  fetch: typeof fetch | undefined;
  headers: Record<string, string>;
  logger: QbrixLogger | undefined;
  logLevel: LogLevel;
}

const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error", "off"];

// precedence: explicit option → QBRIX_LOG → QBRIX_DEBUG (sugar for "debug") →
// "debug" when a logger is injected (opt-in by passing one) → "off" (silent).
function resolveLogLevel(option: LogLevel | undefined, hasLogger: boolean): LogLevel {
  if (option) return option;
  const env = readEnv("QBRIX_LOG");
  if (env && (LOG_LEVELS as readonly string[]).includes(env)) return env as LogLevel;
  if (readEnv("QBRIX_DEBUG")) return "debug";
  return hasLogger ? "debug" : "off";
}

// todo: check the defaults / might want to add the hosted url here / update the timeout to be low latency etc.
const DEFAULTS = {
  baseUrl: "http://localhost:8080",
  timeout: 30_000,
  maxRetries: 2,
  retryOn: [429, 502, 503, 504] as number[],
};

// guarded globalThis access keeps the browser bundle clean and avoids needing `@types/node`.
// the try/catch matters for deno, where reading `process.env` throws without `--allow-env` —
// the sdk treats env as unset rather than crashing.
function readEnv(name: string): string | undefined {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env;
    return env?.[name];
  } catch {
    return undefined;
  }
}

// precedence per option: explicit arg → env var → default
export function resolveConfig(options: QbrixClientOptions = {}): ResolvedConfig {
  const logLevel = resolveLogLevel(options.logLevel, options.logger !== undefined);
  const config: ResolvedConfig = {
    apiKey: options.apiKey ?? readEnv("QBRIX_API_KEY"),
    baseUrl: options.baseUrl ?? readEnv("QBRIX_BASE_URL") ?? DEFAULTS.baseUrl,
    timeout: options.timeout ?? DEFAULTS.timeout,
    maxRetries: options.maxRetries ?? DEFAULTS.maxRetries,
    retryOn: options.retryOn ?? [...DEFAULTS.retryOn],
    fetch: options.fetch,
    headers: options.headers ?? {},
    logger: options.logger ?? (logLevel === "off" ? undefined : consoleLogger),
    logLevel,
  };

  if (config.timeout <= 0) {
    throw new Error(`qbrix: timeout must be > 0, got ${config.timeout}`);
  }
  if (config.maxRetries < 0) {
    throw new Error(`qbrix: maxRetries must be >= 0, got ${config.maxRetries}`);
  }

  return config;
}
