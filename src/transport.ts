import { buildHeaders } from "./client";
import type { ResolvedConfig } from "./config";
import {
  QbrixAPIError,
  QbrixConnectionError,
  QbrixError,
  QbrixTimeoutError,
  RateLimitedError,
  STATUS_TO_ERROR,
} from "./errors";
import type { components } from "./generated";
import { type LogLevel, shouldLog } from "./logger";

export interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
}

const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 8_000;

function emit(
  config: ResolvedConfig,
  level: Exclude<LogLevel, "off">,
  message: string,
  context: Record<string, unknown>,
): void {
  if (config.logger && shouldLog(config.logLevel, level)) {
    config.logger[level](message, context);
  }
}

export async function request<T>(
  config: ResolvedConfig,
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T | undefined> {
  const fetchImpl = config.fetch ?? globalThis.fetch;
  const url = joinUrl(config.baseUrl, path);
  const headers = buildHeaders(config);
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    emit(config, "debug", "request attempt", {
      method,
      path,
      attempt: attempt + 1,
      attempts: config.maxRetries + 1,
    });
    const timeoutSignal = AbortSignal.timeout(config.timeout);
    const signal = combineSignals(options.signal, timeoutSignal);

    let response: Response;
    try {
      response = await fetchImpl(url, { method, headers, body, signal });
    } catch (err) {
      // caller-initiated abort takes precedence and propagates unchanged
      if (options.signal?.aborted) throw options.signal.reason ?? err;
      if (timeoutSignal.aborted) {
        emit(config, "error", "request timed out", { method, path });
        throw new QbrixTimeoutError(`qbrix: request timed out after ${config.timeout}ms`);
      }
      emit(config, "error", "request connection error", { method, path });
      throw new QbrixConnectionError(err instanceof Error ? err.message : String(err));
    }

    if (response.ok) {
      emit(config, "debug", "request succeeded", { method, path, status: response.status });
      if (response.status === 204) return undefined;
      const text = await response.text();
      return text ? (JSON.parse(text) as T) : undefined;
    }

    const error = await makeApiError(response);
    if (!config.retryOn.includes(response.status) || attempt === config.maxRetries) {
      emit(config, "error", "request failed", { method, path, status: response.status });
      throw error;
    }
    const delay = retryDelay(attempt, error);
    emit(config, "warn", "request retrying", {
      method,
      path,
      status: response.status,
      attempt: attempt + 1,
      delayMs: Math.round(delay),
    });
    await sleep(delay, options.signal);
  }

  // unreachable: the final attempt always returns or throws
  throw new QbrixError("qbrix: request failed");
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function combineSignals(caller: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  if (!caller) return timeout;
  const anyFn = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === "function") return anyFn([caller, timeout]);

  // manual fallback for runtimes without AbortSignal.any
  const controller = new AbortController();
  const forward = (source: AbortSignal) => () => controller.abort(source.reason);
  if (caller.aborted) controller.abort(caller.reason);
  else if (timeout.aborted) controller.abort(timeout.reason);
  else {
    caller.addEventListener("abort", forward(caller), { once: true });
    timeout.addEventListener("abort", forward(timeout), { once: true });
  }
  return controller.signal;
}

type WireError = components["schemas"]["ErrorResponse"];

async function makeApiError(response: Response): Promise<QbrixAPIError> {
  // read the body once; fetch streams can't be re-read after JSON.parse fails
  const raw = await response.text();
  let detail = raw || response.statusText;
  let code: WireError["code"] | undefined;
  let context: Record<string, unknown> | undefined;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<WireError>;
      if (typeof parsed.detail === "string") detail = parsed.detail;
      if (typeof parsed.code === "string") code = parsed.code;
      if (parsed.context && typeof parsed.context === "object") {
        context = parsed.context as Record<string, unknown>;
      }
    } catch {
      // non-json body — keep the raw text as detail
    }
  }

  const status = response.status;
  if (status === 429) {
    const header = response.headers.get("Retry-After");
    const seconds = header ? Number.parseFloat(header) : Number.NaN;
    return new RateLimitedError(status, detail, {
      code,
      context,
      retryAfter: Number.isFinite(seconds) ? seconds : undefined,
    });
  }

  const ErrorClass = STATUS_TO_ERROR[status] ?? QbrixAPIError;
  return new ErrorClass(status, detail, { code, context });
}

function retryDelay(attempt: number, error: QbrixAPIError): number {
  if (error instanceof RateLimitedError && error.retryAfter !== undefined) {
    return Math.min(error.retryAfter * 1000, RETRY_MAX_DELAY_MS);
  }
  const base = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  return base + Math.random() * base * 0.1;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
