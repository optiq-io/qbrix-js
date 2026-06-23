// pluggable, leveled logging. the sdk is silent by default (logLevel "off") and
// only emits when a level is configured (via the logLevel option, the QBRIX_LOG
// / QBRIX_DEBUG env vars, or by injecting a logger). the sdk passes only
// non-sensitive context (method, path, status, attempt counts) — never the api
// key, headers, or request/response bodies.
export type LogLevel = "debug" | "info" | "warn" | "error" | "off";

export interface QbrixLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

const RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  off: 100,
};

// emit an event at `event` level only when it meets the configured threshold.
export function shouldLog(configured: LogLevel, event: Exclude<LogLevel, "off">): boolean {
  return RANK[event] >= RANK[configured];
}

// built-in sink for the env / logLevel opt-in; routes each level to console.
export const consoleLogger: QbrixLogger = {
  debug: (message, context) => (context ? console.debug(message, context) : console.debug(message)),
  info: (message, context) => (context ? console.info(message, context) : console.info(message)),
  warn: (message, context) => (context ? console.warn(message, context) : console.warn(message)),
  error: (message, context) => (context ? console.error(message, context) : console.error(message)),
};
