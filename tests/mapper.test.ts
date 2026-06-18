import { describe, expect, it } from "vitest";
import {
  fromFeedbackResponse,
  fromSelectResponse,
  toFeedbackRequest,
  toSelectRequest,
} from "../src/mapper";
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

  it("omits optional vector/metadata when absent", () => {
    const wire = toSelectRequest({ experimentId: "exp_123", context: { id: "ctx_1" } });
    expect(wire).toEqual({ experiment_id: "exp_123", context: { id: "ctx_1" } });
    expect("vector" in wire.context).toBe(false);
    expect("metadata" in wire.context).toBe(false);
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
});

describe("feedback mapping", () => {
  it("maps a feedback request to the snake_case wire shape", () => {
    const params: FeedbackParams = { requestId: "req_abc", reward: 1 };
    expect(toFeedbackRequest(params)).toEqual({ request_id: "req_abc", reward: 1 });
  });

  it("maps a feedback response to the camelCase public shape", () => {
    expect(fromFeedbackResponse({ accepted: true })).toEqual({ accepted: true });
  });
});
