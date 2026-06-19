import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveConfig } from "../src/config";
import {
  AuthenticationError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  type QbrixAPIError,
  QbrixConnectionError,
  QbrixTimeoutError,
  RateLimitedError,
  ServiceUnavailableError,
} from "../src/errors";
import { request } from "../src/transport";

function fetchOf(impl: (url: string, init: RequestInit) => Promise<Response>) {
  return vi.fn(impl) as unknown as typeof fetch;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("request — success", () => {
  it("parses a json body on 2xx", async () => {
    const fetchMock = fetchOf(
      async () => new Response(JSON.stringify({ armId: "a" }), { status: 200 }),
    );
    const config = resolveConfig({ fetch: fetchMock });
    await expect(request(config, "GET", "/x")).resolves.toEqual({ armId: "a" });
  });

  it("returns undefined for 204", async () => {
    const fetchMock = fetchOf(async () => new Response(null, { status: 204 }));
    const config = resolveConfig({ fetch: fetchMock });
    await expect(request(config, "GET", "/x")).resolves.toBeUndefined();
  });

  it("returns undefined for an empty 2xx body", async () => {
    const fetchMock = fetchOf(async () => new Response("", { status: 200 }));
    const config = resolveConfig({ fetch: fetchMock });
    await expect(request(config, "GET", "/x")).resolves.toBeUndefined();
  });

  it("sends method, joined url, headers, and a json body", async () => {
    const fetchMock = fetchOf(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const config = resolveConfig({
      fetch: fetchMock,
      apiKey: "optiq_k",
      baseUrl: "https://api.test",
    });
    await request(config, "POST", "/api/v1/select", { body: { poolId: "p1" } });

    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.test/api/v1/select");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ poolId: "p1" }));
    const headers = init.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe("optiq_k");
    expect(headers["Content-Type"]).toBe("application/json");
  });
});

describe("request — error mapping", () => {
  it.each([
    [400, BadRequestError],
    [401, AuthenticationError],
    [403, ForbiddenError],
    [404, NotFoundError],
    [409, ConflictError],
    [500, InternalServerError],
  ])("maps %i to its error subclass with detail and context", async (status, ErrorClass) => {
    const fetchMock = fetchOf(
      async () =>
        new Response(JSON.stringify({ detail: "nope", context: { field: "armId" } }), { status }),
    );
    const config = resolveConfig({ fetch: fetchMock, maxRetries: 0 });
    const err = await request(config, "GET", "/x").catch((e) => e);
    expect(err).toBeInstanceOf(ErrorClass);
    expect((err as QbrixAPIError).status).toBe(status);
    expect((err as QbrixAPIError).detail).toBe("nope");
    expect((err as QbrixAPIError).context).toEqual({ field: "armId" });
  });

  it("parses the error code from the envelope", async () => {
    const fetchMock = fetchOf(
      async () =>
        new Response(JSON.stringify({ code: "INVALID_API_KEY", detail: "nope" }), { status: 401 }),
    );
    const config = resolveConfig({ fetch: fetchMock, maxRetries: 0 });
    const err = (await request(config, "GET", "/x").catch((e) => e)) as AuthenticationError;
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.code).toBe("INVALID_API_KEY");
  });

  it("leaves code undefined when the body carries none", async () => {
    const fetchMock = fetchOf(
      async () => new Response(JSON.stringify({ detail: "boom" }), { status: 500 }),
    );
    const config = resolveConfig({ fetch: fetchMock, maxRetries: 0 });
    const err = (await request(config, "GET", "/x").catch((e) => e)) as InternalServerError;
    expect(err.code).toBeUndefined();
  });

  it("falls back to the raw body when it is not json", async () => {
    const fetchMock = fetchOf(async () => new Response("plain text", { status: 400 }));
    const config = resolveConfig({ fetch: fetchMock, maxRetries: 0 });
    const err = (await request(config, "GET", "/x").catch((e) => e)) as QbrixAPIError;
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.detail).toBe("plain text");
    expect(err.code).toBeUndefined();
  });

  it("maps 429 to RateLimitedError with code and retryAfter", async () => {
    const fetchMock = fetchOf(
      async () =>
        new Response(JSON.stringify({ code: "RATE_LIMITED", detail: "slow down" }), {
          status: 429,
          headers: { "Retry-After": "3" },
        }),
    );
    const config = resolveConfig({ fetch: fetchMock, maxRetries: 0 });
    const err = (await request(config, "GET", "/x").catch((e) => e)) as RateLimitedError;
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryAfter).toBe(3);
  });

  it("wraps a network failure in QbrixConnectionError", async () => {
    const fetchMock = fetchOf(async () => {
      throw new TypeError("fetch failed");
    });
    const config = resolveConfig({ fetch: fetchMock, maxRetries: 0 });
    await expect(request(config, "GET", "/x")).rejects.toBeInstanceOf(QbrixConnectionError);
  });
});

describe("request — retry", () => {
  it("retries retryable statuses then succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = fetchOf(
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 503 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 })),
    );
    const config = resolveConfig({ fetch: fetchMock, maxRetries: 2 });
    const promise = request(config, "GET", "/x");
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honors Retry-After before retrying a 429", async () => {
    vi.useFakeTimers();
    const fetchMock = fetchOf(
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "Retry-After": "1" } }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 })),
    );
    const config = resolveConfig({ fetch: fetchMock, maxRetries: 1 });
    const promise = request(config, "GET", "/x");

    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still waiting out the 1s Retry-After
    await vi.advanceTimersByTimeAsync(600);
    await expect(promise).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxRetries and throws the last error", async () => {
    vi.useFakeTimers();
    const fetchMock = fetchOf(async () => new Response("{}", { status: 503 }));
    const config = resolveConfig({ fetch: fetchMock, maxRetries: 2 });
    const promise = request(config, "GET", "/x");
    const assertion = expect(promise).rejects.toBeInstanceOf(ServiceUnavailableError);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("does not retry a status outside the allow-list", async () => {
    const fetchMock = fetchOf(async () => new Response("{}", { status: 500 }));
    const config = resolveConfig({ fetch: fetchMock, maxRetries: 2 });
    await expect(request(config, "GET", "/x")).rejects.toBeInstanceOf(InternalServerError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("request — timeout and abort", () => {
  it("throws QbrixTimeoutError when the timeout fires", async () => {
    const fetchMock = fetchOf(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const config = resolveConfig({ fetch: fetchMock, timeout: 20, maxRetries: 0 });
    await expect(request(config, "GET", "/x")).rejects.toBeInstanceOf(QbrixTimeoutError);
  });

  it("propagates a caller abort unchanged", async () => {
    const controller = new AbortController();
    const fetchMock = fetchOf(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const config = resolveConfig({ fetch: fetchMock, timeout: 5_000 });
    const promise = request(config, "GET", "/x", { signal: controller.signal });
    controller.abort(new Error("user cancelled"));
    await expect(promise).rejects.toThrow("user cancelled");
    await expect(promise).rejects.not.toBeInstanceOf(QbrixTimeoutError);
  });
});
