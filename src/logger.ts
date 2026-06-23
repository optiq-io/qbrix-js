// minimal pluggable logging sink. the sdk is silent by default and only emits
// when a consumer injects a logger, so it never pollutes a host app's output.
// the sdk passes only non-sensitive context (method, path, status, attempt
// counts) — never the api key, headers, or request/response bodies.
export interface QbrixLogger {
  debug(message: string, context?: Record<string, unknown>): void;
}
