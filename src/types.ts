// public (camelCase) agent surface, mapped over the snake_case wire shape in mapper.ts.

// stable, machine-readable error identifier from the proxysvc error envelope —
// more granular than the http status. hand-authored (not aliased over the generated
// wire union) so the emitted .d.ts stays a plain string union and doesn't drag the
// whole snake_case `components` shape into the public types. a drift guard in
// tests/types.test.ts fails typecheck if this diverges from the generated union.
export type ErrorCode =
  | "INTERNAL_ERROR"
  | "BAD_REQUEST"
  | "UNKNOWN_PRICE_ID"
  | "FEEDBACK_FAILED"
  | "INVALID_CONTEXT_VECTOR"
  | "INVALID_CONTEXT_PROPERTIES"
  | "INVALID_POLICY_PARAMS"
  | "UNAUTHORIZED"
  | "INVALID_TOKEN"
  | "INVALID_API_KEY"
  | "FORBIDDEN"
  | "INSUFFICIENT_SCOPES"
  | "PLAN_TIER_REQUIRED"
  | "EMAIL_NOT_VERIFIED"
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
  | "GATE_ALREADY_EXISTS"
  | "POOL_HAS_EXPERIMENTS"
  | "CONTEXT_SCHEMA_IMMUTABLE"
  | "EXPERIMENT_RUNNING"
  | "RATE_LIMITED"
  | "USAGE_LIMIT_EXCEEDED"
  | "POOL_CREATION_FAILED"
  | "EXPERIMENT_CREATION_FAILED"
  | "SELECTION_FAILED"
  | "SERVICE_UNAVAILABLE";

export interface Context {
  /** stable identifier for the request source, e.g. a user or session id. drives
   *  deterministic feature-gate rollout. */
  id: string;
  /** named request properties, e.g. `{ device: "mobile", price: 20 }`. encoded
   *  server-side against the experiment's declared context schema. this is how you
   *  give a contextual strategy features. */
  properties?: Record<string, string | number | boolean>;
  /** free-form pairs for feature-gate targeting. never read by the strategy itself. */
  metadata?: Record<string, unknown>;
  /** pre-encoded feature vector; its width must equal the experiment's dim. prefer
   *  `properties` and let qbrix own the encoding. reach for this when you already hold
   *  a learned embedding, when the feature is a quantity you derive yourself (a
   *  similarity score, a model prediction, a PCA component), or when migrating an
   *  existing contextual experiment that needs byte-identical encoding. */
  vector?: number[];
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
  /** null when the experiment is paused — selection still succeeds and returns an arm,
   *  but no feedback token is minted, so there is nothing to report an outcome against. */
  requestId: string | null;
  isDefault: boolean;
}

export interface FeedbackParams {
  requestId: string;
  reward: number;
}
