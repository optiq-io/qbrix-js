---
name: linear-claim
description: Full development loop for picking up a Linear ticket through to an open PR and updating the ticket. Trigger this skill whenever the user references a Linear ticket ID and wants to start working on it — phrases like "take up OPT-131", "let's do OPT-38", "work on OPT-XYZ", "pick up this ticket", "start on [ticket ID]", or similar. Also trigger when the user says "triage this ticket". The skill owns the entire loop: fetch ticket → explore code → plan → branch → implement → commit → PR → move ticket forward. Use it proactively whenever a ticket ID appears alongside intent to implement.
---

# Linear Ticket Workflow

You've been invoked because the user wants to work on a Linear ticket for the `qbrix-js` SDK. Own the full loop end-to-end.

This repo is the `qbrix` npm package — an isomorphic, zero-runtime-dependency TypeScript SDK over the `proxysvc` HTTP API. All work is tracked in the Linear project **qbrix.js** (team **Optiqio**, key `OPT`). The source of truth for the wire contract is the proxysvc source at `../qbrix/svc/proxy/src/proxysvc/` — read it when request/response shapes, status codes, or auth are in doubt.

## Codebase Map

Use this as your first orienteering reference when deciding where to look.

| Area | Path(s) |
|------|---------|
| **Public exports** | `src/index.ts` |
| **Hot-path client** | `src/client.ts` (`QbrixClient` — `select` / `feedback`) |
| **Config resolution** | `src/config.ts` (option → env → default; guarded `process` access) |
| **Transport** | `src/transport.ts` (`fetch` wrapper: retry/backoff, timeout, error mapping) |
| **Errors** | `src/errors.ts` (`QbrixError` hierarchy — part of the public API) |
| **Public types** | `src/types.ts` (hand-authored camelCase surface) |
| **Wire mapping** | `src/mapper.ts` (wire snake_case ↔ public camelCase) |
| **Generated wire types** | `src/generated.ts` (`openapi-typescript` output — internal only) |
| **Management surface** | `qbrix/admin` subpath export (control plane, off the hot path) |
| **Tests** | co-located `*.test.ts` (vitest) |
| **Build** | `tsup.config.ts` → dual ESM + CJS + `.d.ts` |
| **Lint/format** | Biome (`biome.json`) |
| **Versioning** | changesets (`.changeset/`) |
| **CI** | `.github/workflows/` |
| **Wire contract (source of truth)** | `../qbrix/svc/proxy/src/proxysvc/` — proxysvc routers, REST API |

---

## Step 1 — Fetch the Ticket

Use `mcp__linear-server__get_issue` with `includeRelations: true`. Extract:
- `title`, `description` — the spec
- `gitBranchName` — use this exact string for the branch (e.g. `feature/opt-131-fetch-transport-...`)
- `priority`, `projectMilestone`, `dueDate` — scope and urgency context
- `relations` — blockers to flag if present

Move the ticket to **In Progress** before starting work (`mcp__linear-server__save_issue` with `state: "In Progress"`).

---

## Step 2 — Explore the Codebase

This is a single, small TypeScript package — scope exploration accordingly. Spawn any **Explore** agents in a **single message** (parallel).

| Ticket scope | Agents |
|---|---|
| Single file / isolated fix | 0 (explore inline) |
| One module + its tests | 1 |
| Cross-module (e.g. transport + client + errors) | 2 |
| SDK + wire-contract verification against proxysvc | 2–3 |

Give each agent a **distinct**, non-overlapping area. If the change depends on the wire shape, dedicate one agent to reading the relevant proxysvc router/schema under `../qbrix/svc/proxy/src/proxysvc/` and reporting the exact request/response/status-code/auth contract.

`.codegraph/` exists — tell agents (and yourself) to use `codegraph_search`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, `codegraph_node` instead of grep/find for symbol lookups and tracing.

Ask agents to report: key files, data shapes, patterns to follow, and anything that directly informs the implementation.

---

## Step 3 — Plan Mode

Enter plan mode. Think thoroughly. Build the plan incrementally:

**Plan structure:**
- **Context** — why this change is needed, what problem it solves
- **Changes** — exact files to modify, with enough detail to execute without re-reading code
- **Reuse** — call out existing functions/types/utilities to reuse (don't reinvent)
- **Verification** — concrete steps to test the change (`npm run test`, `npm run typecheck`, `npm run lint`)

Use `AskUserQuestion` for any genuine ambiguity before finalizing. Exit plan mode only when the plan is unambiguous enough to execute.

Hold the line on the SDK principles while planning: HTTP/`fetch` only, zero runtime deps, isomorphic (universal primitives only, guard `process`), flat hot-path API, camelCase public surface mapped over the snake_case wire, typed `QbrixError`s never bare errors.

---

## Step 3.5 — Surface Additional Work

Before moving to the branch, scan the approved plan for work the ticket didn't mention but that's clearly implied or at risk. Think thoroughly — check each layer the ticket touches:

- **Wire contract drift**: does the change assume a request/response shape that should be verified against (or has diverged from) the proxysvc source?
- **Generated types**: does this need an `openapi-typescript` regeneration of `src/generated.ts`, or a new mapping in `src/mapper.ts`?
- **Public API surface**: new public types/options that must stay camelCase, be exported from `src/index.ts`, and avoid leaking wire (snake_case) shapes?
- **Isomorphic discipline**: any Node-only or unguarded `process` access that would break browser/Deno/Bun/edge? Any new runtime dependency sneaking in?
- **Errors as API**: new failure modes that need a typed `QbrixError` rather than a bare throw?
- **Admin separation**: management/CRUD logic that belongs under the `qbrix/admin` subpath, not the hot path?
- **Build / exports**: new entry points or `package.json` `exports` / `sideEffects` implications for the dual ESM+CJS build?
- **Changeset**: does this change need a `npx changeset` entry for versioning?
- **Tests**: logic paths or error paths with no coverage?

For each gap found, produce a structured draft:

```
## Draft ticket — <short title>
Problem: <one sentence — what's missing or at risk>
Suggested scope: <what the ticket should cover>
Files likely involved: <paths>
```

Tell the user: "I found N items that aren't in scope for this ticket but should be tracked." Present the drafts and ask whether to file them now or later. For each draft the user approves, invoke the `linear-spec` skill — it will investigate, write a proper spec, and place the ticket in the right project and milestone. Any drafts deferred by the user should appear as a checklist in the PR description's "Out of scope / follow-ups" section.

---

## Step 4 — Create the Branch

Use the `gitBranchName` from the Linear response exactly — don't invent a branch name:

```bash
git checkout -b <gitBranchName>
```

---

## Step 5 — Implement

Execute the approved plan. Make targeted changes only — no incidental refactoring unless the ticket calls for it. Follow the repo's coding standards in `CLAUDE.md`: strict accurate types (no `any` on the public surface), minimal hard-to-misuse API, isomorphic discipline, typed errors, no dead code or speculative abstraction, lowercase log/comment style, and comments only for non-obvious *why*.

Add a changeset (`npx changeset`) when the change is user-facing.

Before committing, run the gates: `npm run typecheck`, `npm run lint`, `npm run test`.

---

## Step 6 — Commit

Check `git log --oneline -5` for the repo's commit message style (conventional commits, lowercase). Reference the ticket ID:

```
feat(transport): retries + timeout + typed errors (OPT-131)

Longer explanation if the change needs context beyond the title.
```

Stage specific files — avoid `git add -A` which can sweep in unrelated changes (including `.codegraph/` artifacts).

---

## Step 7 — Open the PR

1. Read `.github/PULL_REQUEST_TEMPLATE.md` from the repo root if it exists and fill every section using the ticket's title and description as source material. If no template exists yet, write a clear hand-written body (Summary / Changes / Testing / Out of scope).
2. Include any draft follow-up tickets from Step 3.5 in the PR body under "Out of scope / follow-ups".
3. Create the PR:

```bash
gh pr create --title "<title> (OPT-XYZ)" --base main --body "<filled template>"
```

**If `gh` fails with a GraphQL/repository error:** the remote URL may be stale (e.g. old org name after a rename). Diagnose with:

```bash
git remote -v                          # what git thinks
gh repo view --json nameWithOwner      # what GitHub actually resolves
```

If they differ, update the remote:

```bash
git remote set-url origin git@github.com:<correct-org>/<repo>.git
```

Then retry `gh pr create`. Return the PR URL to the user when done.

---

## Step 8 — Move the Ticket Forward

**Do not mark the ticket Done just because the PR is open.** An open, unmerged PR means the work is in review, not complete.

Move the ticket to **In Review** using `mcp__linear-server__save_issue`:

```
save_issue(id: "<ticket-id>", state: "In Review")
```

Then tell the user the ticket is in review and return the PR URL.

**Only move the ticket to Done when the PR is actually merged** — i.e. one of:
- the user tells you it's merged, or
- you merged it yourself in this session (e.g. via `gh pr merge`), confirmed by the command succeeding.

When either holds:

```
save_issue(id: "<ticket-id>", state: "Done")
```

Note: GitHub's `Fixes #N` / `Closes #N` keywords reference **GitHub issues**, not Linear tickets — they will not auto-close a Linear ticket on merge. Linear only auto-completes the ticket on merge if the workspace has GitHub merge automation configured. If you're unsure it's configured, treat the ticket as still **In Review** until the user confirms.

If a state name isn't found, use `mcp__linear-server__list_issue_statuses` with the team name (**Optiqio**) to find the correct state name, then retry.
