# PR body — template + authoring guide

The **canonical template is the repo-root [`.github/PULL_REQUEST_TEMPLATE.md`](../../../.github/PULL_REQUEST_TEMPLATE.md)** — single source of truth. GitHub auto-loads it into the PR description in the web UI, but **`gh pr create` does not**, so when opening a PR from the CLI (Step 7) you must read that file and fill it into `--body` yourself.

This guide records *how* to fill it to match the repo's established PR voice, extracted from OPT-130 (#1) and OPT-131 (#3). The skeleton lives in the template; the conventions below don't.

## Sections

- **Summary** — lead with the user-facing outcome, not the implementation. State what the change *enables* and, in a clause, what it deliberately leaves out ("no request logic — just resolve options and build headers"). Add a context line linking the **spec section** it implements (`MVP Spec §3–4`) and/or naming the **reference impl** it ports (`qbrix-python/_transport/_http/_client.py`). End with `Closes OPT-NNN.`
- **Changes** — one bullet per file, **`bold filename in backticks`** then the behavior change. Describe behavior, never restate the diff. Nest sub-bullets only for non-obvious mechanics (backoff + jitter, `Retry-After` handling, a wire quirk, an env-via-`globalThis` trick). Include a **test** bullet with what's covered and a count, and a `Changeset added (patch|minor|major)` line when the change is user-facing.
- **Design notes** — *optional; omit when nothing is non-obvious.* Record only choices a reviewer would otherwise question: why a knob stayed off the public config surface, a limitation matching the reference impl (`Retry-After` numeric-only), a benign known cycle.
- **Testing** — the gate one-liner exactly: `` `npm run typecheck` ✅ · `npm run lint` ✅ · `npm run test` ✅ (N tests) · `npm run build` ✅ (ESM + CJS + d.ts) ``. Add a `Manual: ...` line for anything checked by hand.
- **Out of scope / follow-ups** — deferred work, each with its ticket **bolded** (`**OPT-38**`). Add a relationship note where it clarifies ("config validation throws a plain `Error` for now; **OPT-131** upgrades it"). Fold in any Step 3.5 drafts the user deferred.

## Conventions

- **Title**: `<concise description> (OPT-NNN)` — the `(OPT-NNN)` suffix is required.
- **Ticket refs**: close once in Summary as `Closes OPT-NNN.`; bold **OPT-NNN** for every follow-up/related ticket.
- **Filenames**: bold inside backticks — **`src/transport.ts`**.
- **Voice**: present tense, terse, lowercase prose under capitalized headings; mirror the SDK principles (isomorphic, zero-dep, typed errors) when they explain a choice.
- `Closes OPT-NNN` is for the Linear ticket; remember GitHub's `Closes #N` keyword targets **GitHub issues**, not Linear — see SKILL Step 8.