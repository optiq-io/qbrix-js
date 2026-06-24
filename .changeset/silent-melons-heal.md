---
"@optiqio/qbrix": minor
---

add the public agent types (`Context`, `Arm`, `SelectParams`, `SelectResult`, `FeedbackParams`, `FeedbackResult`) and the wire ↔ public mapper, generated from a vendored proxysvc openapi spec (`spec/proxysvc.openapi.json` → `src/generated.ts` via `npm run generate`)
