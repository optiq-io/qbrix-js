# CLAUDE.md

Guidance for Claude Code when working in the `qbrix-js` repo.

## What this is

The `qbrix` npm package — a JavaScript/TypeScript SDK for the Qbrix multi-armed
bandit platform. It wraps the `proxysvc` HTTP API. Sibling project to
`qbrix-python`. Tracked in the Linear project **qbrix.js**; the source of truth
is the [qbrix.js SDK — MVP Spec](https://linear.app/optiqio/document/qbrixjs-sdk-mvp-spec-8152cd73f83e).

## The backend & system

Qbrix is an open-source multi-armed bandit platform for production. It separates
the hot path (selection) from the learning path (training): real-time decisions
while the system learns from every feedback event. Used for A/B testing,
recommendations, ad optimization, dynamic pricing — anything balancing
exploration and exploitation.

The system lives at `../qbrix/` (repo root: README, architecture, algorithms).
Services:

| Service | Purpose |
|---------|---------|
| **proxysvc** | API gateway, experiment management, feedback ingestion — what this SDK talks to |
| **motorsvc** | arm selection (hot path) |
| **cortexsvc** | batch training via event sourcing (Redis Streams) |

This SDK integrates against **proxysvc**, implemented in `../qbrix/svc/proxy/`
(source in `../qbrix/svc/proxy/src/proxysvc/`). The wire contract is the REST API
exposed there (`/api/v1/select`, `/api/v1/feedback`, auth via bearer token,
implicit multi-tenant isolation). When in doubt about request/response shapes,
status codes, or auth, read the proxysvc source — it is the source of truth for
the wire format the SDK maps over.

## Principles

- **HTTP/`fetch` only**, **zero runtime dependencies**. Isomorphic: browser,
  Node 18+, Deno, Bun, edge. Use only universal primitives (`fetch`,
  `AbortController`, `crypto.randomUUID()`); guard any `process` access.
- **Flat hot-path API**: `client.select()` / `client.feedback()`.
- **camelCase public types**, mapped over the snake_case wire shape.
- Management/CRUD is a separate `qbrix/admin` entry point (1.1) — never on the
  hot path.

## Project tracking (Linear)

All work on this SDK is tracked in the Linear project **qbrix.js**
([board](https://linear.app/optiqio/project/qbrixjs-1ba067377963)), team
**Optiqio** (key `OPT`). The board is the source of truth for status; the spec is
the [qbrix.js SDK — MVP Spec](https://linear.app/optiqio/document/qbrixjs-sdk-mvp-spec-8152cd73f83e).

- Issues use the `OPT-NNN` identifier (e.g. OPT-130, OPT-131) — reference them in
  branches, commits, and PRs.
- Before starting work, check the issue on the board; move it to in-progress and
  keep its status current as work lands.

## Layout

```
src/
├── index.ts      # public exports
├── client.ts     # QbrixClient
├── config.ts     # option + env resolution (OPT-130)
├── transport.ts  # fetch wrapper: retry/backoff, timeout, error mapping (OPT-131)
├── errors.ts     # QbrixError hierarchy (OPT-131)
├── types.ts      # public camelCase types (OPT-39)
├── mapper.ts     # wire <-> public mapping (OPT-39)
└── generated.ts  # openapi-typescript output (OPT-39)
```

## Commands

```bash
npm run build      # tsup → dual ESM + CJS + .d.ts
npm run test       # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # biome check
npm run format     # biome format --write
```

## Coding standards

SDK / TS / JS best practices:

- Ship strict, accurate types. No `any` on the public surface; prefer precise
  unions and `unknown` over loose types. Public API is camelCase, mapped over the
  snake_case wire shape — keep wire types out of the public surface.
- Design the public API to be minimal and hard to misuse: narrow inputs, explicit
  options objects over positional booleans, sensible defaults, fail fast on bad
  config.
- Isomorphic discipline: universal primitives only (`fetch`, `AbortController`,
  `crypto.randomUUID()`); guard any `process` / Node-only access. Zero runtime
  dependencies.
- Errors are part of the API: throw the typed `QbrixError` hierarchy, never bare
  strings or generic `Error`. Don't swallow errors.
- No dead code, no speculative abstraction, no re-exporting internals. Keep the
  hot path (`select` / `feedback`) lean.
- Test behavior, not implementation; cover error paths and edge cases.

Comments & docstrings — keep code efficient and self-explanatory:

- No unnecessary comments or docstrings. Names and types should carry the meaning.
- Comment only when genuinely needed to understand non-obvious *why* (a tricky
  invariant, a workaround, a wire quirk), or for `TODO`/`FIXME`.
- Never narrate *what* the code does or restate the signature. Delete redundant
  comments rather than maintaining them.

## Conventions

- Lowercase log/comment style (no capitalized first letter), matching the qbrix backend.
- Versioning via changesets. Publishing pipeline lands in OPT-41.
