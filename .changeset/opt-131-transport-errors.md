---
"@optiqio/qbrix": minor
---

add the fetch transport (timeout via AbortSignal, retries with exponential backoff + jitter, `Retry-After` handling) and the typed `QbrixError` hierarchy, with each api status mapped to its error subclass