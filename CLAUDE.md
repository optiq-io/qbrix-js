# CLAUDE.md

Guidance for Claude Code when working in the `qbrix-js` repo.

## What this is

The `qbrix` npm package — a JavaScript/TypeScript SDK for the Qbrix multi-armed
bandit platform. It wraps the proxysvc HTTP API. Sibling project to
`qbrix-python`. Tracked in the Linear project **qbrix.js**; the source of truth
is the [qbrix.js SDK — MVP Spec](https://linear.app/optiqio/document/qbrixjs-sdk-mvp-spec-8152cd73f83e).

## Principles

- **HTTP/`fetch` only**, **zero runtime dependencies**. Isomorphic: browser,
  Node 18+, Deno, Bun, edge. Use only universal primitives (`fetch`,
  `AbortController`, `crypto.randomUUID()`); guard any `process` access.
- **Flat hot-path API**: `client.select()` / `client.feedback()`.
- **camelCase public types**, mapped over the snake_case wire shape.
- Management/CRUD is a separate `qbrix/admin` entry point (1.1) — never on the
  hot path.

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

## Conventions

- Lowercase log/comment style (no capitalized first letter), matching the qbrix backend.
- Versioning via changesets. Publishing pipeline lands in OPT-41.
