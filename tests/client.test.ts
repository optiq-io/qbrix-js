import { describe, expect, it, vi } from "vitest";
import { Qbrix, buildHeaders } from "../src/client";
import { BadRequestError, NotFoundError, QbrixError, RateLimitedError } from "../src/errors";

function fetchOf(impl: (url: string, init: RequestInit) => Promise<Response>) {
  return vi.fn(impl) as unknown as typeof fetch;
}

function calls(fetchMock: typeof fetch): [string, RequestInit][] {
  return (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
}

function call(fetchMock: typeof fetch, index = 0): [string, RequestInit] {
  const found = calls(fetchMock)[index];
  if (!found) throw new Error(`no fetch call ${index}`);
  return found;
}

function bodies(fetchMock: typeof fetch): Record<string, unknown>[] {
  return calls(fetchMock).map(([, init]) => JSON.parse(init.body as string));
}

function body(fetchMock: typeof fetch, index = 0): Record<string, unknown> {
  return JSON.parse(call(fetchMock, index)[1].body as string);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function hanging(_url: string, init: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });
}

describe("Qbrix", () => {
  it("constructs with defaults and exposes a resolved config", () => {
    const client = new Qbrix({ apiKey: "optiq_test" });
    expect(client).toBeInstanceOf(Qbrix);
    expect(client.config.apiKey).toBe("optiq_test");
    expect(client.config.baseUrl).toBe("http://localhost:8000");
    expect(client.config.timeout).toBe(5_000);
  });

  it("accepts an injectable fetch", () => {
    const fakeFetch = (() => {}) as unknown as typeof fetch;
    const client = new Qbrix({ fetch: fakeFetch });
    expect(client.config.fetch).toBe(fakeFetch);
  });
});

describe("buildHeaders", () => {
  it("always sets Accept and Content-Type", () => {
    const headers = buildHeaders(new Qbrix().config);
    expect(headers.Accept).toBe("application/json");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sets X-API-Key only when an api key is present", () => {
    expect(buildHeaders(new Qbrix({ apiKey: "optiq_x" }).config)["X-API-Key"]).toBe("optiq_x");
    expect(buildHeaders(new Qbrix().config)["X-API-Key"]).toBeUndefined();
  });

  it("sets a User-Agent off-browser (document undefined under vitest/node)", () => {
    const headers = buildHeaders(new Qbrix().config);
    expect(headers["User-Agent"]).toMatch(/^qbrix-js\//);
  });

  it("merges user headers last so they override defaults", () => {
    const headers = buildHeaders(
      new Qbrix({ apiKey: "optiq_x", headers: { "X-API-Key": "override", "X-Custom": "1" } })
        .config,
    );
    expect(headers["X-API-Key"]).toBe("override");
    expect(headers["X-Custom"]).toBe("1");
  });
});

const live = {
  option: { key: "bold", name: "Bold", config: { headline: "Pay now" } },
  request_id: "req_abc",
  reason: "live",
};

const offline = { key: "control", config: { headline: "Checkout" } };

describe("Qbrix.select", () => {
  it("posts the loop and context to the select path and returns a Decision", async () => {
    const fetchMock = fetchOf(async () => json(live));
    const client = new Qbrix({ fetch: fetchMock, baseUrl: "https://api.test" });
    const decision = await client.select("checkout-headline", {
      unit: "user-1",
      properties: { device: "mobile" },
    });

    expect(decision).toEqual({
      option: { key: "bold", name: "Bold", config: { headline: "Pay now" } },
      requestId: "req_abc",
      reason: "live",
    });
    const [url, init] = call(fetchMock);
    expect(url).toBe("https://api.test/api/v1/select");
    expect(init.method).toBe("POST");
    expect(body(fetchMock)).toEqual({
      loop: "checkout-headline",
      context: { unit: "user-1", properties: { device: "mobile" } },
    });
  });

  it("returns a draft's fallback without a requestId", async () => {
    const fetchMock = fetchOf(async () =>
      json({ option: { key: "control", name: "Control", config: {} }, reason: "draft" }),
    );
    const decision = await new Qbrix({ fetch: fetchMock }).select("l", { unit: "u" });
    expect(decision.reason).toBe("draft");
    expect(decision.requestId).toBeNull();
    expect(decision.option?.key).toBe("control");
  });

  it("rejects a missing unit before any request, even with offline set", async () => {
    const fetchMock = fetchOf(async () => json(live));
    const client = new Qbrix({ fetch: fetchMock });
    await expect(
      client.select("l", {} as unknown as { unit: string }, { offline }),
    ).rejects.toBeInstanceOf(QbrixError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown loop with the server's message", async () => {
    const fetchMock = fetchOf(async () =>
      json({ detail: "loop nope not found", code: "LOOP_NOT_FOUND" }, 404),
    );
    const err = (await new Qbrix({ fetch: fetchMock })
      .select("nope", { unit: "u" }, { offline })
      .catch((e) => e)) as NotFoundError;
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.detail).toBe("loop nope not found");
    expect(err.code).toBe("LOOP_NOT_FOUND");
  });

  it("rejects an invalid context with a BadRequestError", async () => {
    const fetchMock = fetchOf(async () =>
      json({ detail: "properties must be an object", code: "INVALID_CONTEXT" }, 400),
    );
    await expect(
      new Qbrix({ fetch: fetchMock }).select("l", { unit: "u" }, { offline }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("throws QbrixError when the response body is empty", async () => {
    const fetchMock = fetchOf(async () => new Response("", { status: 200 }));
    await expect(new Qbrix({ fetch: fetchMock }).select("l", { unit: "u" })).rejects.toBeInstanceOf(
      QbrixError,
    );
  });

  it("passes a per-call timeout and maxRetries override through to the transport", async () => {
    const fetchMock = fetchOf(async () => new Response("{}", { status: 503 }));
    const client = new Qbrix({ fetch: fetchMock, maxRetries: 3 });
    await client.select("l", { unit: "u" }, { maxRetries: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Qbrix.select — when qbrix can't be reached", () => {
  const unreachable: [string, () => typeof fetch][] = [
    ["a timeout", () => fetchOf(hanging)],
    [
      "a connection error",
      () =>
        fetchOf(async () => {
          throw new TypeError("fetch failed");
        }),
    ],
    ["a 429", () => fetchOf(async () => new Response("{}", { status: 429 }))],
    ["a 500", () => fetchOf(async () => json({ detail: "x", code: "SELECTION_FAILED" }, 500))],
    ["a 502", () => fetchOf(async () => new Response("{}", { status: 502 }))],
    ["a 503", () => fetchOf(async () => new Response("{}", { status: 503 }))],
    ["a 504", () => fetchOf(async () => new Response("{}", { status: 504 }))],
  ];

  it.each(unreachable)("answers offline on %s", async (_label, makeFetch) => {
    const client = new Qbrix({ fetch: makeFetch(), timeout: 20 });
    await expect(client.select("l", { unit: "u" }, { offline })).resolves.toEqual({
      option: offline,
      requestId: null,
      reason: "offline",
    });
  });

  it.each(unreachable)("answers option null on %s without offline", async (_label, makeFetch) => {
    const client = new Qbrix({ fetch: makeFetch(), timeout: 20 });
    await expect(client.select("l", { unit: "u" })).resolves.toEqual({
      option: null,
      requestId: null,
      reason: "offline",
    });
  });
});

describe("Qbrix.outcome", () => {
  const accepted = { id: "evt_1", at: "2026-10-26T12:30:00Z" };

  it("posts to the outcome path and returns the accepted id and time", async () => {
    const fetchMock = fetchOf(async () => json(accepted, 202));
    const client = new Qbrix({ fetch: fetchMock, baseUrl: "https://api.test" });
    const outcome = await client.outcome("req_abc", 1, { id: "evt_1" });

    expect(outcome).toEqual({ id: "evt_1", at: new Date("2026-10-26T12:30:00Z") });
    const [url, init] = call(fetchMock);
    expect(url).toBe("https://api.test/api/v1/outcome");
    expect(init.method).toBe("POST");
    expect(body(fetchMock)).toEqual({ request_id: "req_abc", value: 1, id: "evt_1" });
  });

  it("mints an id when none is given", async () => {
    const fetchMock = fetchOf(async () => json(accepted, 202));
    await new Qbrix({ fetch: fetchMock }).outcome("req_abc", 1);
    expect(body(fetchMock).id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("mints a fresh id per call", async () => {
    const fetchMock = fetchOf(async () => json(accepted, 202));
    const client = new Qbrix({ fetch: fetchMock });
    await client.outcome("req_abc", 1);
    await client.outcome("req_abc", 1);
    expect(body(fetchMock, 0).id).not.toBe(body(fetchMock, 1).id);
  });

  it("sends the same id on every retry of one call", async () => {
    let attempt = 0;
    const fetchMock = fetchOf(async () => {
      attempt += 1;
      return attempt < 3 ? new Response("{}", { status: 503 }) : json(accepted, 202);
    });
    vi.useFakeTimers();
    try {
      const pending = new Qbrix({ fetch: fetchMock, maxRetries: 2 }).outcome("req_abc", 1);
      await vi.runAllTimersAsync();
      await pending;
    } finally {
      vi.useRealTimers();
    }
    const ids = bodies(fetchMock).map((b) => b.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(1);
  });

  it("sends at as ISO 8601", async () => {
    const fetchMock = fetchOf(async () => json(accepted, 202));
    await new Qbrix({ fetch: fetchMock }).outcome("req_abc", 1, {
      at: new Date("2026-10-26T12:00:00Z"),
    });
    expect(body(fetchMock).at).toBe("2026-10-26T12:00:00.000Z");
  });

  it("rejects an invalid value with the server's rule", async () => {
    const fetchMock = fetchOf(async () =>
      json({ detail: "a conversion is 0 or 1, got 2", code: "INVALID_OUTCOME" }, 400),
    );
    const err = (await new Qbrix({ fetch: fetchMock })
      .outcome("req_abc", 2)
      .catch((e) => e)) as BadRequestError;
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.detail).toBe("a conversion is 0 or 1, got 2");
    expect(err.code).toBe("INVALID_OUTCOME");
  });

  it("rejects when qbrix can't be reached: only select answers offline", async () => {
    const fetchMock = fetchOf(
      async () => new Response("{}", { status: 429, headers: { "Retry-After": "2" } }),
    );
    const err = (await new Qbrix({ fetch: fetchMock })
      .outcome("req_abc", 1)
      .catch((e) => e)) as RateLimitedError;
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.retryAfter).toBe(2);
  });

  it.each([null, ""])("sends nothing for a %j requestId", async (requestId) => {
    const fetchMock = fetchOf(async () => json(accepted, 202));
    await expect(new Qbrix({ fetch: fetchMock }).outcome(requestId, 1)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
