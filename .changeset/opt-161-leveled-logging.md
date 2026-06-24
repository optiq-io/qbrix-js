---
"@optiqio/qbrix": minor
---

leveled logging + env opt-in for the logger sink (OPT-161). `QbrixLogger` now exposes `debug`/`info`/`warn`/`error` (widened from the OPT-137 debug-only sink), and a new `logLevel` option (`"debug" | "info" | "warn" | "error" | "off"`) controls verbosity. logging can also be enabled without a code change via the `QBRIX_LOG` / `QBRIX_DEBUG` environment variables, routing to a built-in console sink. still silent by default; the transport logs attempts/success at debug, retries at warn, and failures at error, and never logs the api key, headers, or bodies.
