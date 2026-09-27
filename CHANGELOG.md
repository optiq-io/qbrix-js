# @optiqio/qbrix

## 0.4.0

### Minor Changes

- 335d334: The default `baseUrl` is `http://localhost:8000`, the self-hosted compose gateway, instead of `http://localhost:8080`, the proxy of a `make dev` setup. Against a `make dev` proxy, set `QBRIX_BASE_URL=http://localhost:8080`.

### Patch Changes

- 9badd9a: The README covers connecting to a self-hosted qbrix: `QBRIX_BASE_URL` is the install's origin, without `/api`.

## 0.3.0

### Minor Changes

- c8b02d5: sub-second per-call timeouts and fail-open fallback for select() (OPT-336)

  `select()` and `feedback()` now take a third `options` argument (`SelectOptions` /
  `FeedbackOptions`) with per-call `timeout` and `maxRetries`, overriding the client-wide
  default — which itself drops from 30s/2 retries to 5s/0 retries so a slow proxy no longer
  stalls the hot path.

  ```ts
  await qbrix.select("checkout-personalization", context, {
    timeout: 200,
    fallback: "control",
  });
  ```

  `select(id, context, { fallback })` resolves the caller-declared arm locally and returns
  `{ ..., isFallback: true }` instead of rejecting, but only for availability failures
  (timeout, connection error, 429, 5xx) — a 4xx caller error still throws.

  `feedback(requestId, reward)` is now a no-op for a falsy `requestId`, so a `null` id from a
  paused experiment (see OPT-389) or a fallback selection can't be fed back against a token
  the server never minted.

## 0.2.0

### Minor Changes

- abe6f9e: send named context properties instead of a hand-encoded vector (OPT-389)

  `Context` gains `properties` — plain named values like `{ device: "mobile", price: 20 }`,
  encoded server-side against the schema the experiment declares. No fixed-width float
  array, and no encoder shared between your app and qbrix.

  ```ts
  await qbrix.select("checkout-personalization", {
    id: userId,
    properties: {
      device: "mobile",
      country: "DE",
      cartValue: 62.5,
      returning: true,
    },
  });
  ```

  `vector` still works and is unchanged. It remains the right choice when you already hold
  a learned embedding, when the feature is a quantity you derive yourself (a similarity
  score, a model prediction, a PCA component), or when you are migrating an existing
  contextual experiment that needs byte-identical encoding. Sending both `vector` and
  `properties` now throws a `QbrixError` locally.

  **Type change worth checking at the call site:** `SelectResult.requestId` is now
  `string | null` rather than `string`. A paused experiment returns a selected arm with no
  feedback token, so `null` was always a possible value — the type simply did not say so.
  If you pass `requestId` straight into `qbrix.feedback()`, TypeScript will now ask you to
  handle the paused case.

  `ErrorCode` picks up the codes the backend already emits, including
  `INVALID_CONTEXT_PROPERTIES` and `CONTEXT_SCHEMA_IMMUTABLE`.

## 0.1.0

### Minor Changes

- b1a8da9: add the fetch transport (timeout via AbortSignal, retries with exponential backoff + jitter, `Retry-After` handling) and the typed `QbrixError` hierarchy, with each api status mapped to its error subclass
- 3e17178: add an optional `logger` sink for quiet-by-default debug logging (OPT-137). pass a `QbrixLogger` (`{ debug(message, context?) }`) on `QbrixClientOptions` and the transport emits structured debug events on every request attempt, success, retry, and failure. silent unless a logger is provided, and the context never carries the api key, headers, or request/response bodies.
- e173bc3: surface the proxysvc error envelope `code` on `QbrixAPIError` (and all subclasses): a stable, machine-readable identifier (`SELECTION_FAILED`, `INVALID_API_KEY`, …) that is more granular than the http status. adds the public `ErrorCode` type and moves the `QbrixAPIError`/`RateLimitedError` constructors to an options bag (`{ code?, context?, retryAfter? }`)
- 780a874: leveled logging + env opt-in for the logger sink (OPT-161). `QbrixLogger` now exposes `debug`/`info`/`warn`/`error` (widened from the OPT-137 debug-only sink), and a new `logLevel` option (`"debug" | "info" | "warn" | "error" | "off"`) controls verbosity. logging can also be enabled without a code change via the `QBRIX_LOG` / `QBRIX_DEBUG` environment variables, routing to a built-in console sink. still silent by default; the transport logs attempts/success at debug, retries at warn, and failures at error, and never logs the api key, headers, or bodies.
- 619f6df: add the hot-path `select(experimentId, context)` and `feedback(requestId, reward)` methods to `QbrixClient`, mapping the camelCase public surface over the proxysvc agent wire contract (`/api/v1/agent/{select,feedback}`)
- 19e1cfe: add the public agent types (`Context`, `Arm`, `SelectParams`, `SelectResult`, `FeedbackParams`, `FeedbackResult`) and the wire ↔ public mapper, generated from a vendored proxysvc openapi spec (`spec/proxysvc.openapi.json` → `src/generated.ts` via `npm run generate`)
