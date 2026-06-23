## Summary

<!-- one or two sentences: what this change does and why, leading with the user-facing
outcome rather than the implementation. link the spec section it implements and/or the
reference impl it ports (e.g. qbrix-python source files). -->

Closes OPT-NNN.

## Changes

<!-- one bullet per file touched: bold the filename in backticks, then describe the
behavior change — not a restatement of the diff. nest sub-bullets for non-obvious
mechanics (an algorithm, a wire quirk, an edge case handled). -->

- **`src/<file>.ts`** — <what changed, in terms of behavior>
- **Tests** — <test files + the behaviors and error paths they cover, with a count>
- Changeset added (<patch | minor | major>). <!-- delete this line if the change is not user-facing -->

## Design notes

<!-- optional — delete this whole section if nothing is non-obvious. record deliberate
choices a reviewer would otherwise question: why something stayed off the public config
surface, a known limitation matching the reference impl, a benign cycle, etc. -->

## Testing

`npm run typecheck` ✅ · `npm run lint` ✅ · `npm run test` ✅ (<N> tests) · `npm run build` ✅ (ESM + CJS + d.ts)

<!-- add a "Manual: ..." line for anything verified by hand (e.g. env resolution, defaults). -->

## Out of scope / follow-ups

<!-- deferred work, each with its tracking ticket bolded (**OPT-NNN**). note the
relationship where it matters, e.g. "X throws a plain Error for now; **OPT-NNN** upgrades
it to the typed hierarchy". list any Step 3.5 drafts the user chose to defer. delete the
section if there are none. -->
