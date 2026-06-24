---
"@optiqio/qbrix": minor
---

add the hot-path `select(experimentId, context)` and `feedback(requestId, reward)` methods to `QbrixClient`, mapping the camelCase public surface over the proxysvc agent wire contract (`/api/v1/agent/{select,feedback}`)
