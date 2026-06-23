// public (camelCase) agent surface, mapped over the snake_case wire shape in mapper.ts.

// stable, machine-readable error identifier from the proxysvc error envelope —
// more granular than the http status. hand-authored (not aliased over the generated
// wire union) so the emitted .d.ts stays a plain string union and doesn't drag the
// whole snake_case `components` shape into the public types. a drift guard in
// tests/types.test.ts fails typecheck if this diverges from the generated union.
export type ErrorCode =
  | "INTERNAL_ERROR"
  | "BAD_REQUEST"
  | "FEEDBACK_FAILED"
  | "INVALID_POLICY_PARAMS"
  | "UNAUTHORIZED"
  | "INVALID_TOKEN"
  | "INVALID_API_KEY"
  | "FORBIDDEN"
  | "INSUFFICIENT_SCOPES"
  | "PLAN_TIER_REQUIRED"
  | "LEARNER_EXPERIMENT_DELETE_FORBIDDEN"
  | "NOT_FOUND"
  | "POOL_NOT_FOUND"
  | "EXPERIMENT_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "GATE_NOT_FOUND"
  | "CONFLICT"
  | "USER_ALREADY_EXISTS"
  | "API_KEY_LIMIT_REACHED"
  | "EXPERIMENT_LIMIT_REACHED"
  | "POOL_HAS_EXPERIMENTS"
  | "RATE_LIMITED"
  | "POOL_CREATION_FAILED"
  | "EXPERIMENT_CREATION_FAILED"
  | "SELECTION_FAILED"
  | "SERVICE_UNAVAILABLE";

export interface Context {
  id: string;
  vector?: number[];
  metadata?: Record<string, unknown>;
}

export interface Arm {
  id: string;
  name: string;
  index: number;
}

export interface SelectParams {
  experimentId: string;
  context: Context;
}

export interface SelectResult {
  arm: Arm;
  requestId: string;
  isDefault: boolean;
}

export interface FeedbackParams {
  requestId: string;
  reward: number;
}
