---
"@optiqio/qbrix": minor
---

**For qbrix next.** `track`, and the decisions a browser remembers. Needs a server whose `select` answers carry `metric` and `window_seconds`.

- `track(metric, value, { decisions?, unit?, id?, at? })` sends an event for a metric and resolves to `{ id, at, credited }`. Events are sent together, up to 500 per request, and each rejects with its own error.
- In a browser, the client remembers the decisions it served, the latest per loop, until each one's window closes. `track` carries the ones made for its metric, on any page and after a reload. When the page is hidden or left, queued events are sent at once with `keepalive`.
- `decisions(metric?)` returns the decisions token, for code to carry to `track` on a server.
- `storage: "local" | "memory" | "none"` says where decisions are kept: `localStorage` by default in a browser, `"memory"` until a visitor consents, and nothing outside a browser. `setStorage()` switches at runtime.
- `flushInterval` (1 s in a browser, 0 elsewhere) and `flush()`.
- `ErrorCode` gains the codes the server added since the last pre-release, `INVALID_DECISIONS` among them.
