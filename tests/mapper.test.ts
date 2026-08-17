import { describe, expect, it } from "vitest";
import { QbrixError } from "../src/errors";
import { fromSelectResponse, toFeedbackRequest, toSelectRequest } from "../src/mapper";
import type { FeedbackParams, SelectParams } from "../src/types";

describe("select mapping", () => {
  it("maps a full select request to the snake_case wire shape", () => {
    const params: SelectParams = {
      experimentId: "exp_123",
      context: { id: "ctx_1", vector: [0.1, 2], metadata: { tier: "pro" } },
    };
    expect(toSelectRequest(params)).toEqual({
      experiment_id: "exp_123",
      context: { id: "ctx_1", vector: [0.1, 2], metadata: { tier: "pro" } },
    });
  });

  it("omits optional properties/vector/metadata when absent", () => {
    const wire = toSelectRequest({ experimentId: "exp_123", context: { id: "ctx_1" } });
    expect(wire).toEqual({ experiment_id: "exp_123", context: { id: "ctx_1" } });
    expect("properties" in wire.context).toBe(false);
    expect("vector" in wire.context).toBe(false);
    expect("metadata" in wire.context).toBe(false);
  });

  it("passes named properties through with their value types intact", () => {
    // the server encodes a numeric property against a declared range, so nothing
    // may be stringified on the way out.
    const wire = toSelectRequest({
      experimentId: "exp_123",
      context: { id: "ctx_1", properties: { device: "mobile", cartValue: 62.5, returning: true } },
    });
    expect(wire.context.properties).toEqual({
      device: "mobile",
      cartValue: 62.5,
      returning: true,
    });
    expect("vector" in wire.context).toBe(false);
  });

  it("carries properties alongside metadata — different channels, no conflict", () => {
    const wire = toSelectRequest({
      experimentId: "exp_123",
      context: { id: "ctx_1", properties: { device: "mobile" }, metadata: { tier: "pro" } },
    });
    expect(wire.context).toEqual({
      id: "ctx_1",
      properties: { device: "mobile" },
      metadata: { tier: "pro" },
    });
  });

  it("rejects vector and properties together", () => {
    const both: SelectParams = {
      experimentId: "exp_123",
      context: { id: "ctx_1", vector: [0.1], properties: { device: "mobile" } },
    };
    expect(() => toSelectRequest(both)).toThrow(QbrixError);
    expect(() => toSelectRequest(both)).toThrow(/not both/);
  });

  it("maps a select response to the camelCase public shape", () => {
    expect(
      fromSelectResponse({
        arm: { id: "arm_a", name: "variant a", index: 0 },
        request_id: "req_abc",
        is_default: false,
      }),
    ).toEqual({
      arm: { id: "arm_a", name: "variant a", index: 0 },
      requestId: "req_abc",
      isDefault: false,
    });
  });

  it("normalizes a paused experiment's absent request_id to null", () => {
    expect(
      fromSelectResponse({
        arm: { id: "arm_a", name: "variant a", index: 0 },
        request_id: null,
        is_default: false,
      }).requestId,
    ).toBeNull();
    expect(
      fromSelectResponse({
        arm: { id: "arm_a", name: "variant a", index: 0 },
        is_default: false,
      }).requestId,
    ).toBeNull();
  });
});

describe("feedback mapping", () => {
  it("maps a feedback request to the snake_case wire shape", () => {
    const params: FeedbackParams = { requestId: "req_abc", reward: 1 };
    expect(toFeedbackRequest(params)).toEqual({ request_id: "req_abc", reward: 1 });
  });
});
