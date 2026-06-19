import { describe, expect, it } from "vitest";
import type { components } from "../src/generated";
import type { ErrorCode } from "../src/types";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// compile-time drift guard: this only typechecks while the hand-authored public
// ErrorCode union stays mutually assignable with the generated proxysvc wire union.
// if a spec regen adds/removes a code, `tsc` (npm run typecheck) fails here until
// src/types.ts is updated.
const errorCodeMatchesWire: Equal<ErrorCode, components["schemas"]["ErrorCode"]> = true;

describe("ErrorCode", () => {
  it("stays in sync with the generated proxysvc wire union", () => {
    expect(errorCodeMatchesWire).toBe(true);
  });
});
