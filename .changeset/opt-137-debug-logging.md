---
"@optiqio/qbrix": minor
---

add an optional `logger` sink for quiet-by-default debug logging (OPT-137). pass a `QbrixLogger` (`{ debug(message, context?) }`) on `QbrixClientOptions` and the transport emits structured debug events on every request attempt, success, retry, and failure. silent unless a logger is provided, and the context never carries the api key, headers, or request/response bodies.
