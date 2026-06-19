import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  BadGatewayError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalServerError,
  NotFoundError,
  QbrixAPIError,
  QbrixConnectionError,
  QbrixError,
  QbrixTimeoutError,
  RateLimitedError,
  STATUS_TO_ERROR,
  ServiceUnavailableError,
} from "../src/errors";

describe("QbrixAPIError", () => {
  it("carries status, detail, code, and context", () => {
    const err = new QbrixAPIError(400, "bad input", {
      code: "BAD_REQUEST",
      context: { field: "armId" },
    });
    expect(err.status).toBe(400);
    expect(err.detail).toBe("bad input");
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.context).toEqual({ field: "armId" });
  });

  it("formats the message as [status] detail", () => {
    expect(new QbrixAPIError(404, "missing").message).toBe("[404] missing");
  });

  it("leaves code and context undefined when not provided", () => {
    const err = new QbrixAPIError(500, "boom");
    expect(err.code).toBeUndefined();
    expect(err.context).toBeUndefined();
  });
});

describe("error hierarchy", () => {
  it("api error subclasses chain up to QbrixError and Error", () => {
    const err = new NotFoundError(404, "missing");
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err).toBeInstanceOf(QbrixAPIError);
    expect(err).toBeInstanceOf(QbrixError);
    expect(err).toBeInstanceOf(Error);
  });

  it("sets name to the concrete subclass", () => {
    expect(new ForbiddenError(403, "nope").name).toBe("ForbiddenError");
    expect(new QbrixTimeoutError("slow").name).toBe("QbrixTimeoutError");
  });

  it("connection and timeout errors are QbrixErrors but not api errors", () => {
    expect(new QbrixConnectionError("down")).toBeInstanceOf(QbrixError);
    expect(new QbrixConnectionError("down")).not.toBeInstanceOf(QbrixAPIError);
    expect(new QbrixTimeoutError("slow")).toBeInstanceOf(QbrixError);
    expect(new QbrixTimeoutError("slow")).not.toBeInstanceOf(QbrixAPIError);
  });
});

describe("RateLimitedError", () => {
  it("carries an optional retryAfter", () => {
    expect(new RateLimitedError(429, "slow down", { retryAfter: 2.5 }).retryAfter).toBe(2.5);
    expect(new RateLimitedError(429, "slow down").retryAfter).toBeUndefined();
  });

  it("carries code alongside retryAfter", () => {
    const err = new RateLimitedError(429, "slow down", { code: "RATE_LIMITED", retryAfter: 1 });
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryAfter).toBe(1);
  });
});

describe("STATUS_TO_ERROR", () => {
  it("maps each status to the right subclass", () => {
    expect(STATUS_TO_ERROR[400]).toBe(BadRequestError);
    expect(STATUS_TO_ERROR[401]).toBe(AuthenticationError);
    expect(STATUS_TO_ERROR[403]).toBe(ForbiddenError);
    expect(STATUS_TO_ERROR[404]).toBe(NotFoundError);
    expect(STATUS_TO_ERROR[409]).toBe(ConflictError);
    expect(STATUS_TO_ERROR[429]).toBe(RateLimitedError);
    expect(STATUS_TO_ERROR[500]).toBe(InternalServerError);
    expect(STATUS_TO_ERROR[502]).toBe(BadGatewayError);
    expect(STATUS_TO_ERROR[503]).toBe(ServiceUnavailableError);
    expect(STATUS_TO_ERROR[504]).toBe(GatewayTimeoutError);
  });
});
