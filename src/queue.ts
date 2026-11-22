import { inBrowser } from "./config";
import type { ResolvedConfig } from "./config";
import { QbrixAPIError, QbrixError, STATUS_TO_ERROR } from "./errors";
import type { components } from "./generated";
import { request } from "./transport";

type WireTrackEvent = components["schemas"]["TrackRequest"];
type WireTrackResult = components["schemas"]["TrackResult"];
type WireTrackBatchResponse = components["schemas"]["TrackBatchResponse"];

export interface TrackedWire {
  id: string;
  at: string;
  credited: number | null;
}

interface Pending {
  event: WireTrackEvent;
  resolve: (result: TrackedWire) => void;
  reject: (error: unknown) => void;
}

const BATCH_MAX = 500;
// browsers cap the bodies of in-flight keepalive requests at 64 KiB in total
const KEEPALIVE_MAX_BYTES = 60_000;

const ERROR_STATUS: Record<string, number> = {
  INVALID_DECISIONS: 400,
  INVALID_OUTCOME: 400,
  METRIC_NOT_FOUND: 404,
};

function errorOf(error: NonNullable<WireTrackResult["error"]>): QbrixAPIError {
  const status = ERROR_STATUS[error.code] ?? 500;
  const ErrorClass = STATUS_TO_ERROR[status] ?? QbrixAPIError;
  return new ErrorClass(status, error.detail, { code: error.code });
}

/** track events, sent together: those of one turn of the event loop, or of one
 *  `flushInterval`, up to 500 per request. */
export class EventQueue {
  private pending: Pending[] = [];
  private scheduled = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly config: ResolvedConfig) {
    if (inBrowser()) {
      window.addEventListener("pagehide", () => this.drain(true));
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.drain(true);
      });
    }
  }

  push(event: WireTrackEvent): Promise<TrackedWire> {
    const sent = new Promise<TrackedWire>((resolve, reject) => {
      this.pending.push({ event, resolve, reject });
    });
    if (this.pending.length >= BATCH_MAX) this.drain(false);
    else this.schedule();
    return sent;
  }

  /** sends everything queued now, and settles when every request has answered. */
  async flush(): Promise<void> {
    await this.drain(false);
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    if (this.config.flushInterval <= 0) {
      queueMicrotask(() => this.drain(false));
    } else {
      this.timer = setTimeout(() => this.drain(false), this.config.flushInterval);
    }
  }

  private drain(keepalive: boolean): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.scheduled = false;
    const taken = this.pending;
    this.pending = [];
    return Promise.all(
      this.batches(taken, keepalive).map((batch) => this.send(batch, keepalive)),
    ).then(() => undefined);
  }

  private batches(pending: Pending[], keepalive: boolean): Pending[][] {
    const batches: Pending[][] = [];
    let batch: Pending[] = [];
    let bytes = 0;
    for (const item of pending) {
      const size = JSON.stringify(item.event).length + 1;
      const full = batch.length === BATCH_MAX || (keepalive && bytes + size > KEEPALIVE_MAX_BYTES);
      if (batch.length > 0 && full) {
        batches.push(batch);
        batch = [];
        bytes = 0;
      }
      batch.push(item);
      bytes += size;
    }
    if (batch.length > 0) batches.push(batch);
    return batches;
  }

  private async send(batch: Pending[], keepalive: boolean): Promise<void> {
    try {
      const wire = await request<WireTrackBatchResponse>(this.config, "POST", "/api/v1/track", {
        body: { events: batch.map((item) => item.event) },
        keepalive,
      });
      if (wire?.results?.length !== batch.length) {
        throw new QbrixError("qbrix: track answered a different number of events");
      }
      batch.forEach((item, i) => {
        const result = wire.results[i] as WireTrackResult;
        if (result.error) item.reject(errorOf(result.error));
        else
          item.resolve({
            id: result.id ?? "",
            at: result.at ?? "",
            credited: result.credited ?? null,
          });
      });
    } catch (err) {
      for (const item of batch) item.reject(err);
    }
  }
}
