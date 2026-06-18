import { describe, expect, it, vi } from "vitest";
import { QbrixClient, buildHeaders } from "../src/client";
import { QbrixError, RateLimitedError } from "../src/errors";

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
    expect(client.config.baseUrl).toBe("http://localhost:8080");
    expect(client.config.timeout).toBe(30_000);
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
});
