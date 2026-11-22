import { QbrixError } from "./errors";
import type { components } from "./generated";
import type { TrackedWire } from "./queue";
import type { Context, Decision, Outcome, Tracked } from "./types";

type WireSelectRequest = components["schemas"]["SelectRequest"];
type WireSelectResponse = components["schemas"]["SelectResponse"];
type WireOutcomeRequest = components["schemas"]["OutcomeRequest"];
type WireOutcomeResponse = components["schemas"]["OutcomeResponse"];
type WireTrackEvent = components["schemas"]["TrackRequest"];

const UNIT_MAX_LENGTH = 256;

export function toSelectRequest(loop: string, context: Context): WireSelectRequest {
  // the server rejects these too, but a plain-js caller gets no type checking, and
  // with `offline` set a missing unit would otherwise look like a working page.
  const unit: unknown = context?.unit;
  if (typeof unit !== "string" || unit.trim() === "") {
    throw new QbrixError("qbrix: context.unit is required, a non-empty string");
  }
  if (unit.length > UNIT_MAX_LENGTH) {
    throw new QbrixError(`qbrix: context.unit is at most ${UNIT_MAX_LENGTH} characters`);
  }
  return {
    loop,
    context: {
      unit,
      ...(context.properties !== undefined && { properties: context.properties }),
    },
  };
}

export function fromSelectResponse(wire: WireSelectResponse): Decision {
  return {
    option: { key: wire.option.key, name: wire.option.name, config: wire.option.config },
    requestId: wire.request_id ?? null,
    reason: wire.reason,
  };
}

export function toOutcomeRequest(
  requestId: string,
  value: number,
  id: string,
  at: Date | number | undefined,
): WireOutcomeRequest {
  return {
    request_id: requestId,
    value,
    id,
    ...(at !== undefined && { at: new Date(at).toISOString() }),
  };
}

export function fromOutcomeResponse(wire: WireOutcomeResponse): Outcome {
  return { id: wire.id, at: new Date(wire.at) };
}

export function toTrackEvent(
  metric: string,
  value: number,
  id: string,
  options: { decisions?: string; unit?: string; at?: Date | number },
): WireTrackEvent {
  return {
    metric,
    value,
    id,
    ...(options.decisions !== undefined && { decisions: options.decisions }),
    ...(options.unit !== undefined && { unit: options.unit }),
    ...(options.at !== undefined && { at: new Date(options.at).toISOString() }),
  };
}

export function fromTracked(wire: TrackedWire): Tracked {
  return { id: wire.id, at: new Date(wire.at), credited: wire.credited };
}
