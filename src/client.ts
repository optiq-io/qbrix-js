import type { ResolvedConfig } from "./config";
import { resolveConfig } from "./config";
import {
  BadGatewayError,
  GatewayTimeoutError,
  InternalServerError,
  QbrixConnectionError,
  QbrixError,
  QbrixTimeoutError,
  RateLimitedError,
  ServiceUnavailableError,
} from "./errors";
import type { components } from "./generated";
import type { LogLevel, QbrixLogger } from "./logger";
import {
  fromOutcomeResponse,
  fromSelectResponse,
  fromTracked,
  toOutcomeRequest,
  toSelectRequest,
  toTrackEvent,
} from "./mapper";
import { DecisionMemory } from "./memory";
import { EventQueue } from "./queue";
import { request } from "./transport";
import type {
  Context,
  Decision,
  Outcome,
  OutcomeOptions,
  Settings,
  Storage,
  TrackOptions,
  Tracked,
} from "./types";
import { VERSION } from "./version";

// failures that mean "qbrix is unreachable or unhealthy right now", as opposed to a
// caller error (bad request, auth, unknown loop, ...). select() answers offline only
// for these — never for errors that indicate the request itself was wrong, since
// silently swallowing those would hide real bugs behind a fabricated decision.
const AVAILABILITY_ERRORS = [
  QbrixConnectionError,
  QbrixTimeoutError,
  RateLimitedError,
  InternalServerError,
  BadGatewayError,
  ServiceUnavailableError,
  GatewayTimeoutError,
];

function isAvailabilityError(err: unknown): boolean {
  return AVAILABILITY_ERRORS.some((ErrorClass) => err instanceof ErrorClass);
}

export interface QbrixOptions {
  /** qbrix api key (prefix `optiq_`). falls back to `QBRIX_API_KEY`. */
  apiKey?: string;
  /** base url of your qbrix install. falls back to `QBRIX_BASE_URL`. */
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
  /** where the decisions this client served are remembered, for `track` and
   *  `decisions()`. "local" in a browser, "none" elsewhere. */
  storage?: Storage;
  /** how long `track` events wait to be sent together, in ms. 1000 in a browser,
   *  0 elsewhere (events of the same turn still go together). */
  flushInterval?: number;
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

export class Qbrix {
  readonly config: ResolvedConfig;
  private readonly memory: DecisionMemory;
  private readonly events: EventQueue;

  constructor(options: QbrixOptions = {}) {
    this.config = resolveConfig(options);
    this.memory = new DecisionMemory(
      this.config.storage,
      `${this.config.baseUrl}|${this.config.apiKey ?? ""}`,
    );
    this.events = new EventQueue(this.config);
  }

  async select(loop: string, context: Context, settings: Settings = {}): Promise<Decision> {
    const body = toSelectRequest(loop, context);
    try {
      const wire = await request<components["schemas"]["SelectResponse"]>(
        this.config,
        "POST",
        "/api/v1/select",
        { body, timeout: settings.timeout, maxRetries: settings.maxRetries },
      );
      if (wire === undefined) {
        throw new QbrixError("qbrix: select returned no response body");
      }
      if (wire.request_id && wire.metric && typeof wire.window_seconds === "number") {
        this.memory.remember({
          loop,
          metric: wire.metric,
          requestId: wire.request_id,
          expiresAt: Date.now() + wire.window_seconds * 1000,
        });
      }
      return fromSelectResponse(wire);
    } catch (err) {
      if (isAvailabilityError(err)) {
        return { option: settings.offline ?? null, requestId: null, reason: "offline" };
      }
      throw err;
    }
  }

  async outcome(
    requestId: string | null,
    value: number,
    options: OutcomeOptions = {},
  ): Promise<Outcome | null> {
    if (!requestId) return null;
    // minted once per call, so every retry of this call counts once on the server
    const id = options.id ?? crypto.randomUUID();
    const body = toOutcomeRequest(requestId, value, id, options.at);
    const wire = await request<components["schemas"]["OutcomeResponse"]>(
      this.config,
      "POST",
      "/api/v1/outcome",
      { body, timeout: options.timeout, maxRetries: options.maxRetries },
    );
    if (wire === undefined) {
      throw new QbrixError("qbrix: outcome returned no response body");
    }
    return fromOutcomeResponse(wire);
  }

  /** an event for a metric. it credits the decisions it carries, the ones this
   *  client remembers for the metric by default, or else waits to be matched by
   *  its unit. resolves null, sending nothing, when it has neither. */
  async track(metric: string, value: number, options: TrackOptions = {}): Promise<Tracked | null> {
    const decisions = options.decisions || this.decisions(metric) || undefined;
    if (decisions === undefined && options.unit === undefined) return null;
    const id = options.id ?? crypto.randomUUID();
    const event = toTrackEvent(metric, value, id, {
      decisions,
      unit: options.unit,
      at: options.at,
    });
    return fromTracked(await this.events.push(event));
  }

  /** the decisions token: the decisions this client served and still remembers,
   *  only those made for `metric` when given, for code to carry to `track` on a
   *  server. null when there are none. */
  decisions(metric?: string): string | null {
    const remembered = this.memory.current(metric);
    return remembered.length > 0 ? remembered.map((entry) => entry.requestId).join(".") : null;
  }

  /** switches where decisions are remembered, e.g. to "local" once the visitor
   *  consents. "memory" and "none" remove them from the device. */
  setStorage(storage: Storage): void {
    this.memory.use(storage);
  }

  /** sends every queued `track` event now; await it before a script exits. */
  flush(): Promise<void> {
    return this.events.flush();
  }
}
