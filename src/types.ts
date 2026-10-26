// public (camelCase) request-path surface, mapped over the snake_case wire shape in mapper.ts.

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
  | "INVALID_METRIC"
  | "INVALID_LOOP"
  | "INVALID_CONTEXT"
  | "INVALID_OUTCOME"
  | "INVALID_REQUEST_ID"
  | "INVALID_CURSOR"
  | "UNAUTHORIZED"
  | "INVALID_TOKEN"
  | "INVALID_API_KEY"
  | "FORBIDDEN"
  | "INSUFFICIENT_SCOPES"
  | "PLAN_TIER_REQUIRED"
  | "EMAIL_NOT_VERIFIED"
  | "SIGNUP_CLOSED"
  | "LEARNER_EXPERIMENT_DELETE_FORBIDDEN"
  | "NOT_FOUND"
  | "POOL_NOT_FOUND"
  | "EXPERIMENT_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "GATE_NOT_FOUND"
  | "METRIC_NOT_FOUND"
  | "LOOP_NOT_FOUND"
  | "CYCLE_NOT_FOUND"
  | "CONFLICT"
  | "USER_ALREADY_EXISTS"
  | "API_KEY_LIMIT_REACHED"
  | "EXPERIMENT_LIMIT_REACHED"
  | "GATE_ALREADY_EXISTS"
  | "POOL_HAS_EXPERIMENTS"
  | "CONTEXT_SCHEMA_IMMUTABLE"
  | "CONTEXT_DIM_IMMUTABLE"
  | "EXPERIMENT_RUNNING"
  | "METRIC_NAME_TAKEN"
  | "LOOP_KEY_TAKEN"
  | "LOOP_NOT_DRAFT"
  | "LOOP_NOT_PAUSED"
  | "UNPROCESSABLE_ENTITY"
  | "INVALID_IDENTITY"
  | "RATE_LIMITED"
  | "INVITE_LIMIT_EXCEEDED"
  | "USAGE_LIMIT_EXCEEDED"
  | "POOL_CREATION_FAILED"
  | "EXPERIMENT_CREATION_FAILED"
  | "SELECTION_FAILED"
  | "SERVICE_UNAVAILABLE";

export interface Context {
  /** who or what sees the decision: a user, a session, an account. required, and
   *  stable for as long as its outcome can arrive. */
  unit: string;
  /** what the app knows about the request, e.g. `{ device: "mobile", plan: "pro" }`.
   *  recorded with the decision. */
  properties?: Record<string, unknown>;
}

export interface Option {
  key: string;
  name?: string;
  /** what the app renders for this option. */
  config: Record<string, unknown>;
}

/** why `select` answered as it did. `offline` comes from the sdk itself, when qbrix
 *  couldn't be reached. */
export type Reason =
  | "live"
  | "committed"
  | "outside_delivery"
  | "paused"
  | "draft"
  | "retired"
  | "offline"
  | (string & {});

export interface Decision {
  /** null only when qbrix couldn't be reached and no `offline` option was given. */
  option: Option | null;
  /** present only when the decision can learn. pass it to `outcome` as it is. */
  requestId: string | null;
  reason: Reason;
}

export interface Settings {
  /** the option to answer with, without throwing, when qbrix can't be reached
   *  (timeout, connection error, 429, or 5xx). */
  offline?: Option;
  /** overrides the client's default timeout (ms) for this call only. */
  timeout?: number;
  /** overrides the client's default max retry attempts for this call only. */
  maxRetries?: number;
}

export interface OutcomeOptions {
  /** makes the outcome count once. minted by the sdk when absent, and kept across
   *  the call's retries. */
  id?: string;
  /** when it happened, as a Date or epoch milliseconds. qbrix uses the time it
   *  receives the outcome when absent. */
  at?: Date | number;
  /** overrides the client's default timeout (ms) for this call only. */
  timeout?: number;
  /** overrides the client's default max retry attempts for this call only. */
  maxRetries?: number;
}

export interface Outcome {
  id: string;
  at: Date;
}
