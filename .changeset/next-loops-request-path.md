---
"@optiqio/qbrix": minor
---

**For qbrix next.** Built against qbrix next · phase 1 (Skeleton), server [`optiq-io/qbrix@372219e`](https://github.com/optiq-io/qbrix/commit/372219e). It speaks only to a server with next switched on (`PROXY_NEXT_ENABLED=true`), and it can break between phases. `npm install @optiqio/qbrix` keeps installing the stable 0.4.x.

The client is `Qbrix`, with the request path for loops:

- `select(loop, context, settings?)` takes the loop's key or id and a context with a required `unit` and optional `properties`. It returns a `Decision`: the `option` (key, name, config), a `requestId` when the decision can learn, and the `reason` (`live`, `draft`, `paused`, …).
- When qbrix can't be reached (timeout, connection error, 429, 5xx), `select` never throws. It answers `settings.offline` with `requestId: null` and reason `offline`, or `option: null` when no `offline` was given. Caller errors (400, 401, 403, 404) still throw.
- `outcome(requestId, value, { id?, at? })` reports what happened after one decision and resolves to `{ id, at }`. A null `requestId` sends nothing. The SDK mints `id` once per call, so its retries count once.

`QbrixClient`, `select(experimentId, …)` and `feedback` are gone from this line.