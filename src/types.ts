// public (camelCase) agent surface, mapped over the snake_case wire shape in mapper.ts.

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

export interface FeedbackResult {
  accepted: boolean;
}
