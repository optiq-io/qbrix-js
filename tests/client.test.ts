import { describe, expect, it, vi } from "vitest";
import { QbrixClient, buildHeaders } from "../src/client";
import { NotFoundError, QbrixError, QbrixTimeoutError, RateLimitedError } from "../src/errors";

function fetchOf(impl: (url: string, init: RequestInit) => Promise<Response>) {
  return vi.fn(impl) as unknown as typeof fetch;
}

function lastBody(fetchMock: typeof fetch): unknown {
  const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls;
  const [, init] = calls[calls.length - 1] as [string, RequestInit];
  return JSON.parse(init.body as string);
}

describe("QbrixClient", () => {
  it("constructs with defaults and exposes a resolved config", () => {
    const client = new QbrixClient({ apiKey: "optiq_test" });
    expect(client).toBeInstanceOf(QbrixClient);
    expect(client.config.apiKey).toBe("optiq_test");
    expect(client.config.baseUrl).toBe("http://localhost:8000");
    expect(client.config.timeout).toBe(5_000);
  });

  it("accepts an injectable fetch", () => {
    const fakeFetch = (() => {}) as unknown as typeof fetch;
    const client = new QbrixClient({ fetch: fakeFetch });
    expect(client.config.fetch).toBe(fakeFetch);
  });
});

describe("buildHeaders", () => {
  it("always sets Accept and Content-Type", () => {
    const headers = buildHeaders(new QbrixClient().config);
    expect(headers.Accept).toBe("application/json");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sets X-API-Key only when an api key is present", () => {
    expect(buildHeaders(new QbrixClient({ apiKey: "optiq_x" }).config)["X-API-Key"]).toBe(
      "optiq_x",
    );
    expect(buildHeaders(new QbrixClient().config)["X-API-Key"]).toBeUndefined();
  });

  it("sets a User-Agent off-browser (document undefined under vitest/node)", () => {
    const headers = buildHeaders(new QbrixClient().config);
    expect(headers["User-Agent"]).toMatch(/^qbrix-js\//);
  });

  it("merges user headers last so they override defaults", () => {
    const headers = buildHeaders(
      new QbrixClient({
        apiKey: "optiq_x",
        headers: { "X-API-Key": "override", "X-Custom": "1" },
      }).config,
    );
    expect(headers["X-API-Key"]).toBe("override");
    expect(headers["X-Custom"]).toBe("1");
  });
});

describe("QbrixClient.select", () => {
  const selectResponse = {
    arm: { id: "arm_1", name: "blue", index: 0 },
    request_id: "req_abc",
    is_default: false,
  };

  it("maps the wire response to a camelCase SelectResult", async () => {
    const fetchMock = fetchOf(
      async () => new Response(JSON.stringify(selectResponse), { status: 200 }),
    );
    const client = new QbrixClient({ fetch: fetchMock, baseUrl: "https://api.test" });
    const result = await client.select("exp_1", { id: "ctx_1" });
    expect(result).toEqual({
      arm: { id: "arm_1", name: "blue", index: 0 },
      requestId: "req_abc",
      isDefault: false,
      isFallback: false,
    });
  });

  it("returns a result with a null requestId for a paused experiment", async () => {
    // a paused experiment still selects an arm, it just mints no feedback token.
    // that is a normal response, not an error.
    const fetchMock = fetchOf(
      async () =>
        new Response(JSON.stringify({ ...selectResponse, request_id: null }), { status: 200 }),
    );
    const client = new QbrixClient({ fetch: fetchMock, baseUrl: "https://api.test" });
    const result = await client.select("exp_1", { id: "ctx_1" });
    expect(result.requestId).toBeNull();
    expect(result.arm.name).toBe("blue");
  });

  it("selects with named properties", async () => {
    const fetchMock = fetchOf(
      async () => new Response(JSON.stringify(selectResponse), { status: 200 }),
    );
    const client = new QbrixClient({ fetch: fetchMock, baseUrl: "https://api.test" });
    await client.select("exp_1", {
      id: "ctx_1",
      properties: { device: "mobile", cartValue: 62.5, returning: true },
    });

    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string).context).toEqual({
      id: "ctx_1",
      properties: { device: "mobile", cartValue: 62.5, returning: true },
    });
  });

  it("posts the experiment id and context to the agent select path", async () => {
    const fetchMock = fetchOf(
      async () => new Response(JSON.stringify(selectResponse), { status: 200 }),
    );
    const client = new QbrixClient({ fetch: fetchMock, baseUrl: "https://api.test" });
    await client.select("exp_1", { id: "ctx_1", vector: [0.5], metadata: { tier: "gold" } });

    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.test/api/v1/agent/select");
    expect(init.method).toBe("POST");
    expect(lastBody(fetchMock)).toEqual({
      experiment_id: "exp_1",
      context: { id: "ctx_1", vector: [0.5], metadata: { tier: "gold" } },
    });
  });

  it("throws QbrixError when the response body is empty", async () => {
    const fetchMock = fetchOf(async () => new Response("", { status: 200 }));
    const client = new QbrixClient({ fetch: fetchMock });
    await expect(client.select("exp_1", { id: "ctx_1" })).rejects.toBeInstanceOf(QbrixError);
  });

  it("propagates the typed error hierarchy (429 → RateLimitedError)", async () => {
    const fetchMock = fetchOf(
      async () => new Response("{}", { status: 429, headers: { "Retry-After": "2" } }),
    );
    const client = new QbrixClient({ fetch: fetchMock, maxRetries: 0 });
    const err = (await client.select("exp_1", { id: "ctx_1" }).catch((e) => e)) as RateLimitedError;
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.retryAfter).toBe(2);
  });

  it("passes a per-call timeout and maxRetries override through to the transport", async () => {
    const fetchMock = fetchOf(async () => new Response("{}", { status: 503 }));
    const client = new QbrixClient({ fetch: fetchMock, maxRetries: 3 });
    await client.select("exp_1", { id: "ctx_1" }, { maxRetries: 0 }).catch(() => undefined);
    // the per-call override (0), not the client-wide default (3), governs attempts
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

const fallbackArm = { id: "arm_fallback", name: "control", index: 0 };

describe("QbrixClient.select — fallback", () => {
  it("resolves the fallback arm on timeout instead of throwing", async () => {
    const fetchMock = fetchOf(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const client = new QbrixClient({ fetch: fetchMock, timeout: 20, maxRetries: 0 });
    const result = await client.select("exp_1", { id: "ctx_1" }, { fallback: fallbackArm });
    expect(result).toEqual({
      arm: fallbackArm,
      requestId: null,
      isDefault: true,
      isFallback: true,
    });
  });

  it("resolves the fallback arm on a connection error", async () => {
    const fetchMock = fetchOf(async () => {
      throw new TypeError("fetch failed");
    });
    const client = new QbrixClient({ fetch: fetchMock, maxRetries: 0 });
    const result = await client.select("exp_1", { id: "ctx_1" }, { fallback: fallbackArm });
    expect(result.isFallback).toBe(true);
    expect(result.requestId).toBeNull();
  });

  it("resolves the fallback arm on a 503", async () => {
    const fetchMock = fetchOf(async () => new Response("{}", { status: 503 }));
    const client = new QbrixClient({ fetch: fetchMock, maxRetries: 0 });
    const result = await client.select("exp_1", { id: "ctx_1" }, { fallback: fallbackArm });
    expect(result.isFallback).toBe(true);
  });

  it("does not fall back on a 404 — a caller error must still surface", async () => {
    const fetchMock = fetchOf(async () => new Response("{}", { status: 404 }));
    const client = new QbrixClient({ fetch: fetchMock, maxRetries: 0 });
    await expect(
      client.select("exp_1", { id: "ctx_1" }, { fallback: fallbackArm }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("still rejects on timeout when no fallback is given", async () => {
    const fetchMock = fetchOf(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const client = new QbrixClient({ fetch: fetchMock, timeout: 20, maxRetries: 0 });
    await expect(client.select("exp_1", { id: "ctx_1" })).rejects.toBeInstanceOf(QbrixTimeoutError);
  });
});

describe("QbrixClient.feedback", () => {
  it("posts request id and reward and resolves to void on 201", async () => {
    const fetchMock = fetchOf(
      async () => new Response(JSON.stringify({ accepted: true }), { status: 201 }),
    );
    const client = new QbrixClient({ fetch: fetchMock, baseUrl: "https://api.test" });
    await expect(client.feedback("req_abc", 1)).resolves.toBeUndefined();

    const [url] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.test/api/v1/agent/feedback");
    expect(lastBody(fetchMock)).toEqual({ request_id: "req_abc", reward: 1 });
  });

  it("propagates errors on a non-2xx status", async () => {
    const fetchMock = fetchOf(async () => new Response("{}", { status: 404 }));
    const client = new QbrixClient({ fetch: fetchMock, maxRetries: 0 });
    await expect(client.feedback("req_missing", 1)).rejects.toBeInstanceOf(QbrixError);
  });

  it("is a no-op for a null requestId (paused experiment or fallback) — never hits the wire", async () => {
    const fetchMock = fetchOf(async () => new Response("{}", { status: 201 }));
    const client = new QbrixClient({ fetch: fetchMock });
    await expect(client.feedback(null, 1)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is a no-op for an empty-string requestId — never hits the wire", async () => {
    const fetchMock = fetchOf(async () => new Response("{}", { status: 201 }));
    const client = new QbrixClient({ fetch: fetchMock });
    await expect(client.feedback("", 1)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
