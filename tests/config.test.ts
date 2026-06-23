import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveConfig } from "../src/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveConfig", () => {
  it("applies defaults when no options or env are set", () => {
    const config = resolveConfig();
    expect(config).toEqual({
      apiKey: undefined,
      baseUrl: "http://localhost:8080",
      timeout: 30_000,
      maxRetries: 2,
      retryOn: [429, 502, 503, 504],
      fetch: undefined,
      headers: {},
      logger: undefined,
      logLevel: "off",
    });
  });

  it("uses explicit args over defaults", () => {
    const config = resolveConfig({
      apiKey: "optiq_arg",
      baseUrl: "https://api.example.com",
      timeout: 5_000,
      maxRetries: 0,
      retryOn: [503],
    });
    expect(config.apiKey).toBe("optiq_arg");
    expect(config.baseUrl).toBe("https://api.example.com");
    expect(config.timeout).toBe(5_000);
    expect(config.maxRetries).toBe(0);
    expect(config.retryOn).toEqual([503]);
  });

  it("falls back to env vars when args are absent", () => {
    vi.stubEnv("QBRIX_API_KEY", "optiq_env");
    vi.stubEnv("QBRIX_BASE_URL", "https://env.example.com");
    const config = resolveConfig();
    expect(config.apiKey).toBe("optiq_env");
    expect(config.baseUrl).toBe("https://env.example.com");
  });

  it("prefers explicit args over env vars (arg > env > default)", () => {
    vi.stubEnv("QBRIX_API_KEY", "optiq_env");
    vi.stubEnv("QBRIX_BASE_URL", "https://env.example.com");
    const config = resolveConfig({ apiKey: "optiq_arg", baseUrl: "https://arg.example.com" });
    expect(config.apiKey).toBe("optiq_arg");
    expect(config.baseUrl).toBe("https://arg.example.com");
  });

  it("does not mutate the shared default retryOn array", () => {
    const a = resolveConfig();
    a.retryOn.push(418);
    const b = resolveConfig();
    expect(b.retryOn).toEqual([429, 502, 503, 504]);
  });

  it("throws when timeout is not positive", () => {
    expect(() => resolveConfig({ timeout: 0 })).toThrow(/timeout must be > 0/);
    expect(() => resolveConfig({ timeout: -1 })).toThrow(/timeout must be > 0/);
  });

  it("throws when maxRetries is negative", () => {
    expect(() => resolveConfig({ maxRetries: -1 })).toThrow(/maxRetries must be >= 0/);
  });
});

describe("resolveConfig — logging", () => {
  const noopLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  it("is off and silent by default", () => {
    const config = resolveConfig();
    expect(config.logLevel).toBe("off");
    expect(config.logger).toBeUndefined();
  });

  it("turns on debug + a console sink when QBRIX_DEBUG is set", () => {
    vi.stubEnv("QBRIX_DEBUG", "1");
    const config = resolveConfig();
    expect(config.logLevel).toBe("debug");
    expect(config.logger).toBeDefined();
  });

  it("reads a level from QBRIX_LOG", () => {
    vi.stubEnv("QBRIX_LOG", "warn");
    const config = resolveConfig();
    expect(config.logLevel).toBe("warn");
    expect(config.logger).toBeDefined();
  });

  it("ignores an invalid QBRIX_LOG value", () => {
    vi.stubEnv("QBRIX_LOG", "loud");
    const config = resolveConfig();
    expect(config.logLevel).toBe("off");
    expect(config.logger).toBeUndefined();
  });

  it("prefers the logLevel option over env (option > env > default)", () => {
    vi.stubEnv("QBRIX_LOG", "error");
    expect(resolveConfig({ logLevel: "debug" }).logLevel).toBe("debug");
  });

  it("an injected logger implies debug and is passed through untouched", () => {
    const config = resolveConfig({ logger: noopLogger });
    expect(config.logLevel).toBe("debug");
    expect(config.logger).toBe(noopLogger);
  });
});
