import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveConfig } from "../src/config";
import { BadRequestError, NotFoundError, ServiceUnavailableError } from "../src/errors";
import { EventQueue } from "../src/queue";

type Init = RequestInit & { keepalive?: boolean };

function answering(answer?: (events: Record<string, unknown>[]) => unknown) {
  return vi.fn(async (_url: string, init: Init) => {
    const { events } = JSON.parse(init.body as string) as { events: Record<string, unknown>[] };
    const body = answer?.(events) ?? {
      results: events.map((e) => ({ id: e.id, at: "2026-11-22T10:00:00Z", credited: 1 })),
    };
    return new Response(JSON.stringify(body), { status: 202 });
  });
}

function sent(fetchMock: ReturnType<typeof answering>): Record<string, unknown>[][] {
  return fetchMock.mock.calls.map(
    ([, init]) => (JSON.parse(init.body as string) as { events: Record<string, unknown>[] }).events,
  );
}

function event(id: string, decisions?: string) {
  return { metric: "purchase", value: 1, id, ...(decisions && { decisions }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("EventQueue", () => {
  it("sends the events of one turn together", async () => {
    const fetchMock = answering();
    const queue = new EventQueue(resolveConfig({ fetch: fetchMock as unknown as typeof fetch }));

    const results = await Promise.all([queue.push(event("a")), queue.push(event("b"))]);

    expect(sent(fetchMock)).toEqual([[event("a"), event("b")]]);
    expect(results.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("waits the flush interval, and flush() sends at once", async () => {
    vi.useFakeTimers();
    const fetchMock = answering();
    const queue = new EventQueue(
      resolveConfig({ fetch: fetchMock as unknown as typeof fetch, flushInterval: 1_000 }),
    );

    const tracked = queue.push(event("a"));
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).not.toHaveBeenCalled();

    await queue.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(tracked).resolves.toMatchObject({ id: "a", credited: 1 });
  });

  it("splits more than 500 events across requests", async () => {
    const fetchMock = answering();
    const queue = new EventQueue(resolveConfig({ fetch: fetchMock as unknown as typeof fetch }));

    await Promise.all(Array.from({ length: 501 }, (_, i) => queue.push(event(`e${i}`))));

    expect(sent(fetchMock).map((events) => events.length)).toEqual([500, 1]);
  });

  it("rejects only the events the server refused, with their own error", async () => {
    const fetchMock = answering(() => ({
      results: [
        { id: "a", at: "2026-11-22T10:00:00Z", credited: 1 },
        { error: { code: "INVALID_DECISIONS", detail: "no decision verifies" } },
        { error: { code: "METRIC_NOT_FOUND", detail: "no metric" } },
      ],
    }));
    const queue = new EventQueue(resolveConfig({ fetch: fetchMock as unknown as typeof fetch }));

    const [a, b, c] = await Promise.allSettled([
      queue.push(event("a")),
      queue.push(event("b")),
      queue.push(event("c")),
    ]);

    expect(a.status).toBe("fulfilled");
    expect((b as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestError);
    expect((b as PromiseRejectedResult).reason.code).toBe("INVALID_DECISIONS");
    expect((c as PromiseRejectedResult).reason).toBeInstanceOf(NotFoundError);
  });

  it("rejects every event of a failed request", async () => {
    const fetchMock = vi.fn(async () => new Response("down", { status: 503 }));
    const queue = new EventQueue(resolveConfig({ fetch: fetchMock as unknown as typeof fetch }));

    const results = await Promise.allSettled([queue.push(event("a")), queue.push(event("b"))]);

    for (const result of results) {
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(ServiceUnavailableError);
    }
  });

  describe("in a browser", () => {
    function browser() {
      const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
      const win = new EventTarget();
      vi.stubGlobal("window", win);
      vi.stubGlobal("document", doc);
      return { win, doc };
    }

    it("flushes with keepalive when the page is hidden", async () => {
      const { win } = browser();
      const fetchMock = answering();
      const queue = new EventQueue(
        resolveConfig({ fetch: fetchMock as unknown as typeof fetch, flushInterval: 60_000 }),
      );

      const tracked = queue.push(event("a"));
      win.dispatchEvent(new Event("pagehide"));

      await expect(tracked).resolves.toMatchObject({ id: "a" });
      expect(fetchMock.mock.calls[0]?.[1].keepalive).toBe(true);
    });

    it("flushes when the tab goes to the background", async () => {
      const { doc } = browser();
      const fetchMock = answering();
      const queue = new EventQueue(
        resolveConfig({ fetch: fetchMock as unknown as typeof fetch, flushInterval: 60_000 }),
      );

      const tracked = queue.push(event("a"));
      doc.visibilityState = "hidden";
      doc.dispatchEvent(new Event("visibilitychange"));

      await expect(tracked).resolves.toMatchObject({ id: "a" });
    });

    it("keeps each keepalive request under the browser's body cap", async () => {
      const { win } = browser();
      const fetchMock = answering();
      const queue = new EventQueue(
        resolveConfig({ fetch: fetchMock as unknown as typeof fetch, flushInterval: 60_000 }),
      );
      const token = Array.from({ length: 50 }, () => "x".repeat(114)).join(".");

      const all = Promise.all(
        Array.from({ length: 30 }, (_, i) => queue.push(event(`e${i}`, token))),
      );
      win.dispatchEvent(new Event("pagehide"));
      await all;

      for (const [, init] of fetchMock.mock.calls) {
        expect((init.body as string).length).toBeLessThan(64 * 1024);
      }
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
  });
});
