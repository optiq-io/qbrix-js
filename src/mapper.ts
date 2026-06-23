import type { components } from "./generated";
import type { FeedbackParams, SelectParams, SelectResult } from "./types";

type WireSelectRequest = components["schemas"]["AgentSelectRequest"];
type WireSelectResponse = components["schemas"]["AgentSelectResponse"];
type WireFeedbackRequest = components["schemas"]["AgentFeedbackRequest"];

export function toSelectRequest(params: SelectParams): WireSelectRequest {
  const { id, vector, metadata } = params.context;
  return {
    experiment_id: params.experimentId,
    context: {
      id,
      ...(vector !== undefined && { vector }),
      ...(metadata !== undefined && { metadata }),
    },
  };
}

export function fromSelectResponse(wire: WireSelectResponse): SelectResult {
  return {
    arm: { id: wire.arm.id, name: wire.arm.name, index: wire.arm.index },
    requestId: wire.request_id,
    isDefault: wire.is_default,
  };
}

export function toFeedbackRequest(params: FeedbackParams): WireFeedbackRequest {
  return {
    request_id: params.requestId,
    reward: params.reward,
  };
}
