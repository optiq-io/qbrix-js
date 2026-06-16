import { describe, expect, it } from "vitest";
import { QbrixClient, buildHeaders } from "../src/client";

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
