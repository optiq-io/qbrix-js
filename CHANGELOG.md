# @optiqio/qbrix

## 0.1.0

### Minor Changes

- b1a8da9: add the fetch transport (timeout via AbortSignal, retries with exponential backoff + jitter, `Retry-After` handling) and the typed `QbrixError` hierarchy, with each api status mapped to its error subclass
- 3e17178: add an optional `logger` sink for quiet-by-default debug logging (OPT-137). pass a `QbrixLogger` (`{ debug(message, context?) }`) on `QbrixClientOptions` and the transport emits structured debug events on every request attempt, success, retry, and failure. silent unless a logger is provided, and the context never carries the api key, headers, or request/response bodies.
- e173bc3: surface the proxysvc error envelope `code` on `QbrixAPIError` (and all subclasses): a stable, machine-readable identifier (`SELECTION_FAILED`, `INVALID_API_KEY`, …) that is more granular than the http status. adds the public `ErrorCode` type and moves the `QbrixAPIError`/`RateLimitedError` constructors to an options bag (`{ code?, context?, retryAfter? }`)
- 780a874: leveled logging + env opt-in for the logger sink (OPT-161). `QbrixLogger` now exposes `debug`/`info`/`warn`/`error` (widened from the OPT-137 debug-only sink), and a new `logLevel` option (`"debug" | "info" | "warn" | "error" | "off"`) controls verbosity. logging can also be enabled without a code change via the `QBRIX_LOG` / `QBRIX_DEBUG` environment variables, routing to a built-in console sink. still silent by default; the transport logs attempts/success at debug, retries at warn, and failures at error, and never logs the api key, headers, or bodies.
- 619f6df: add the hot-path `select(experimentId, context)` and `feedback(requestId, reward)` methods to `QbrixClient`, mapping the camelCase public surface over the proxysvc agent wire contract (`/api/v1/agent/{select,feedback}`)
- 19e1cfe: add the public agent types (`Context`, `Arm`, `SelectParams`, `SelectResult`, `FeedbackParams`, `FeedbackResult`) and the wire ↔ public mapper, generated from a vendored proxysvc openapi spec (`spec/proxysvc.openapi.json` → `src/generated.ts` via `npm run generate`)
