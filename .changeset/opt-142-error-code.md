---
"@optiqio/qbrix": minor
---

surface the proxysvc error envelope `code` on `QbrixAPIError` (and all subclasses): a stable, machine-readable identifier (`SELECTION_FAILED`, `INVALID_API_KEY`, …) that is more granular than the http status. adds the public `ErrorCode` type and moves the `QbrixAPIError`/`RateLimitedError` constructors to an options bag (`{ code?, context?, retryAfter? }`)
