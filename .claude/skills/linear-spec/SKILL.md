---
name: linear-spec
description: >
  Principal-engineer spec loop: take a rough idea, investigation finding, or draft ticket description,
  deeply investigate the qbrix-js SDK codebase (and the proxysvc wire contract), and produce a
  fully-specced Linear ticket placed in the right project and milestone. Trigger when the user says
  "spec this", "create a ticket for X", "file a ticket", "draft a spec for", "write up a ticket", or
  when linear-claim Step 3.5 surfaces a follow-up finding that the user approves for filing.
---

# Linear Spec Workflow

You've been invoked to spec and file a Linear ticket for the `qbrix-js` SDK. Think like a **principal engineer** who knows this SDK and its backend contract end-to-end: understand the problem deeply, investigate before prescribing, then write a spec that any engineer can pick up and execute without ambiguity.

This repo is the `qbrix` npm package — an isomorphic, zero-runtime-dependency TypeScript SDK over the `proxysvc` HTTP API. Work is tracked in the Linear project **qbrix.js** (team **Optiqio**, key `OPT`). The wire-contract source of truth is `../qbrix/svc/proxy/src/proxysvc/`.

---

## Codebase Map (quick reference)

| Area | Path(s) |
|------|---------|
| **Public exports** | `src/index.ts` |
| **Hot-path client** | `src/client.ts` (`QbrixClient` — `select` / `feedback`) |
| **Config resolution** | `src/config.ts` (option → env → default; guarded `process`) |
| **Transport** | `src/transport.ts` (`fetch`: retry/backoff, timeout, error mapping) |
| **Errors** | `src/errors.ts` (`QbrixError` hierarchy) |
| **Public types** | `src/types.ts` (camelCase public surface) |
| **Wire mapping** | `src/mapper.ts` (snake_case ↔ camelCase) |
| **Generated wire types** | `src/generated.ts` (`openapi-typescript` output) |
| **Management surface** | `qbrix/admin` subpath (control plane) |
| **Tests** | co-located `*.test.ts` (vitest) |
| **Build / lint / versioning** | `tsup.config.ts`, `biome.json`, `.changeset/` |
| **CI** | `.github/workflows/` |
| **Wire contract (source of truth)** | `../qbrix/svc/proxy/src/proxysvc/` |
| **Sibling reference SDK** | `../qbrix-python/` (proven design to port) |

---

## Step 1 — Ingest the Input

Accept one of these input forms:
- A **rough idea** from the user ("we should add X", "I think we need Y")
- A **draft finding** from `linear-claim` Step 3.5 (structured block with Problem / Suggested scope / Files)
- A **vague complaint** ("the retry behavior is surprising", "errors are hard to catch")

Extract:
- The **core problem** — what's broken, missing, or suboptimal
- The **implied scope** — which modules / layers are likely involved
- Any **constraints** mentioned (isomorphic, zero-dep, backwards compat, hot-path latency, etc.)

If the input is too vague to investigate meaningfully, ask one clarifying question before proceeding.

---

## Step 2 — Investigation

Think through which parts of the SDK (and backend contract) are relevant, then spawn **Explore** agents in parallel. This is a small package — scale modestly:

| Implied scope | Agents |
|---|---|
| Isolated module / utility change | 1 |
| Multi-module (e.g. transport + client + errors) | 2 |
| SDK change that hinges on the wire contract | 2–3 (one dedicated to proxysvc) |

Each agent must have a **distinct, non-overlapping** focus. Good examples:
- "Find every caller of `request()` in transport and what options they pass"
- "Read the proxysvc `/api/v1/select` + `/api/v1/feedback` routers and report exact request/response/status/auth shapes"
- "Find how `qbrix-python` implements this and what design we should port"
- "Find every place we touch `process` / env and confirm it's guarded for isomorphic use"

`.codegraph/` exists — instruct agents to use `codegraph_search`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, `codegraph_node`.

Ask agents to return: current behavior, pain points, relevant file paths, patterns already in place, and anything that could constrain the solution.

---

## Step 3 — Principal Engineer Analysis

Before writing anything, reason through the following. Think thoroughly — this is the most important step.

**Problem framing**
- What is the actual root cause vs. the surface symptom?
- Is this a bug, a missing feature, a design limitation, or tech debt?
- What breaks or degrades if this is left unfixed?

**Solution space**
- What are 2–3 possible approaches? What are the trade-offs?
- Which fits best given the SDK's principles — isomorphic, zero-dep, flat hot-path API, camelCase-over-wire, typed errors?
- Is there an existing pattern in `qbrix-js` or a proven design in `qbrix-python` to port rather than invent?

**Scope boundaries**
- What's explicitly in scope?
- What's adjacent but intentionally out of scope (and why)?
- Does this touch the hot path (`select` / `feedback`)? If so, flag latency and lean-ness sensitivity. Management/CRUD belongs under `qbrix/admin`, not the hot path.
- Does it affect the public API surface (must stay camelCase, exported, no wire leakage)?

**Dependencies and risks**
- Does this block or get blocked by other known work (check the qbrix.js board)?
- Does it require regenerating `src/generated.ts` from the proxysvc OpenAPI spec, or a new `src/mapper.ts` mapping?
- Does it risk the isomorphic guarantee (Node-only APIs, unguarded `process`) or add a runtime dependency?
- Any backwards-compatibility concern for existing SDK consumers / the published `qbrix` package?

**Effort signal**
- Small (< 1 day), Medium (1–3 days), Large (3–5 days), XL (needs breakdown)
- If XL: propose how to split it into smaller tickets.

---

## Step 4 — Write the Spec

Produce the full ticket body in this structure. Write it as if handing off to a senior engineer who is capable but hasn't thought about this problem.

```markdown
## Problem

<2–4 sentences. What's wrong or missing, and the impact on SDK consumers or maintainers.>

## Context

<Key findings from the investigation. Include relevant file paths, the relevant proxysvc wire
 contract if applicable, and any design constraints (isomorphic, zero-dep, hot-path) that shape the
 solution. Keep it factual — this is evidence, not persuasion.>

## Proposed Approach

<The chosen approach from the solution space analysis. Explain the reasoning for picking it over
 alternatives. Reference any qbrix-python design being ported. Include a rough sequence of changes if
 the order matters.>

## Scope

**In scope:**
- <bullet list>

**Out of scope:**
- <bullet list — be explicit about what this ticket does NOT cover>

## Acceptance Criteria

- [ ] <concrete, verifiable condition>
- [ ] <typecheck / lint / test gates pass>
- [ ] <...>

## Files Likely Affected

| File / Directory | Change |
|---|---|
| `src/transport.ts` | <what changes and why> |

## Dependencies

- Blocks: <ticket IDs or "none">
- Blocked by: <ticket IDs or "none">
- Generated-types regen needed (`src/generated.ts`): yes / no
- New mapper mapping needed (`src/mapper.ts`): yes / no
- Changeset needed: yes / no
- Affects isomorphic guarantee / zero-dep: yes / no

## Effort Estimate

<Small / Medium / Large / XL> — <one-sentence rationale>
```

---

## Step 5 — Determine Project and Milestone

**Look up available projects and milestones** before asking the user:

1. Call `mcp__linear-server__list_projects` — the default target is **qbrix.js** unless the work clearly belongs elsewhere.
2. Call `mcp__linear-server__list_milestones` (or `get_project` with relations) to see the qbrix.js milestones (e.g. M1 Foundation & client core, M2 Agent surface & types, M3 Quality/docs/examples, M4 Distribution, M5 Management).
3. Apply this reasoning to pick the best fit:
   - Transport / config / client-core → **M1 · Foundation & client core**
   - Types, mapper, `select`/`feedback` → **M2 · Agent surface & types**
   - Tests, docs, examples, logging, isomorphic smoke matrix → **M3 · Quality, docs & examples**
   - npm publish / release pipeline → **M4 · Distribution**
   - `qbrix/admin` control plane → **M5 · Management**
4. If a clear match exists, state your recommendation and reasoning.
5. If two or more milestones are plausible, present them with `AskUserQuestion` — show names, current issue counts, and due dates if available. Let the user choose.

Never silently default to a milestone without showing your reasoning.

---

## Step 6 — Confirm and File

Present the full spec to the user with a one-paragraph plain-English summary of what the ticket proposes and why. Then ask:

> "Ready to file this? I'll create it in **qbrix.js / [Milestone]**."

On confirmation, call `mcp__linear-server__save_issue` with:
- `title` — concise imperative, e.g. "add Retry-After honoring to transport backoff"
- `description` — the full markdown spec from Step 4
- `projectId` — resolved in Step 5 (qbrix.js)
- `milestoneId` — resolved in Step 5
- `priority` — infer from severity: `urgent` (hot-path correctness / shipping blocker), `high` (user-facing API or types), `medium` (improvement), `low` (polish / repo hygiene)
- `labelIds` — apply relevant labels if discoverable via `mcp__linear-server__list_issue_labels`

Return the created ticket URL to the user.
