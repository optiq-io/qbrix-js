import { describe, expect, it } from "vitest";
import { QbrixError } from "../src/errors";
import {
  fromOutcomeResponse,
  fromSelectResponse,
  toOutcomeRequest,
  toSelectRequest,
} from "../src/mapper";
import type { Context } from "../src/types";

describe("select mapping", () => {
  it("maps a select request to the wire shape", () => {
    expect(
      toSelectRequest("checkout-headline", { unit: "user-1", properties: { device: "mobile" } }),
    ).toEqual({
      loop: "checkout-headline",
      context: { unit: "user-1", properties: { device: "mobile" } },
    });
  });

  it("omits properties when absent", () => {
    const wire = toSelectRequest("checkout-headline", { unit: "user-1" });
    expect(wire).toEqual({ loop: "checkout-headline", context: { unit: "user-1" } });
    expect("properties" in (wire.context ?? {})).toBe(false);
  });

  it("passes properties through with their value types intact", () => {
    const wire = toSelectRequest("l", {
      unit: "u",
      properties: { device: "mobile", cartValue: 62.5, returning: true },
    });
    expect(wire.context?.properties).toEqual({
      device: "mobile",
      cartValue: 62.5,
      returning: true,
    });
  });

  it.each([
    ["missing", {}],
    ["empty", { unit: "" }],
    ["blank", { unit: "   " }],
    ["not a string", { unit: 42 }],
  ])("rejects a %s unit", (_label, context) => {
    expect(() => toSelectRequest("l", context as unknown as Context)).toThrow(QbrixError);
    expect(() => toSelectRequest("l", context as unknown as Context)).toThrow(/context\.unit/);
  });

  it("rejects a missing context", () => {
    expect(() => toSelectRequest("l", undefined as unknown as Context)).toThrow(/context\.unit/);
  });

  it("rejects a unit longer than 256 characters, and accepts 256", () => {
    expect(() => toSelectRequest("l", { unit: "u".repeat(257) })).toThrow(/256/);
    expect(toSelectRequest("l", { unit: "u".repeat(256) }).context?.unit).toHaveLength(256);
  });

  it("maps a select response to a Decision", () => {
    expect(
      fromSelectResponse({
        option: { key: "bold", name: "Bold", config: { headline: "Pay now", size: 3 } },
        request_id: "req_abc",
        reason: "live",
      }),
    ).toEqual({
      option: { key: "bold", name: "Bold", config: { headline: "Pay now", size: 3 } },
      requestId: "req_abc",
      reason: "live",
    });
  });

  it("normalizes an absent or null request_id to null", () => {
    const option = { key: "control", name: "Control", config: {} };
    expect(fromSelectResponse({ option, request_id: null, reason: "draft" }).requestId).toBeNull();
    expect(fromSelectResponse({ option, reason: "paused" }).requestId).toBeNull();
  });
});

describe("outcome mapping", () => {
  it("maps an outcome request to the wire shape, without at when absent", () => {
    const wire = toOutcomeRequest("req_abc", 1, "evt_1", undefined);
    expect(wire).toEqual({ request_id: "req_abc", value: 1, id: "evt_1" });
    expect("at" in wire).toBe(false);
  });

  it("sends at as ISO 8601 from a Date or epoch milliseconds", () => {
    const ms = Date.UTC(2026, 9, 26, 12, 30, 0);
    expect(toOutcomeRequest("r", 1, "e", new Date(ms)).at).toBe("2026-10-26T12:30:00.000Z");
    expect(toOutcomeRequest("r", 1, "e", ms).at).toBe("2026-10-26T12:30:00.000Z");
  });

  it("maps an outcome response's at to a Date", () => {
    const outcome = fromOutcomeResponse({ id: "evt_1", at: "2026-10-26T12:30:00Z" });
    expect(outcome.id).toBe("evt_1");
    expect(outcome.at).toBeInstanceOf(Date);
    expect(outcome.at.toISOString()).toBe("2026-10-26T12:30:00.000Z");
  });
});
