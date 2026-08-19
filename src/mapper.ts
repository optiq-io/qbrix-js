import { QbrixError } from "./errors";
import type { components } from "./generated";
import type { FeedbackParams, SelectParams, SelectResult } from "./types";

type WireSelectRequest = components["schemas"]["AgentSelectRequest"];
type WireSelectResponse = components["schemas"]["AgentSelectResponse"];
type WireFeedbackRequest = components["schemas"]["AgentFeedbackRequest"];

export function toSelectRequest(params: SelectParams): WireSelectRequest {
  const { id, properties, metadata, vector } = params.context;
  // the server rejects this too, but a plain-js caller gets no type checking and
  // deserves better than a round trip to find out.
  if (vector !== undefined && properties !== undefined) {
    throw new QbrixError("qbrix: send context.vector or context.properties, not both");
  }
  return {
    experiment_id: params.experimentId,
    context: {
      id,
      ...(properties !== undefined && { properties }),
      ...(metadata !== undefined && { metadata }),
      ...(vector !== undefined && { vector }),
    },
  };
}

export function fromSelectResponse(wire: WireSelectResponse): SelectResult {
  return {
    arm: { id: wire.arm.id, name: wire.arm.name, index: wire.arm.index },
    // absent for a paused experiment, which mints no feedback token
    requestId: wire.request_id ?? null,
    isDefault: wire.is_default,
    // a real wire response is never a client-side fallback
    isFallback: false,
  };
}

export function toFeedbackRequest(params: FeedbackParams): WireFeedbackRequest {
  return {
    request_id: params.requestId,
    reward: params.reward,
  };
}
