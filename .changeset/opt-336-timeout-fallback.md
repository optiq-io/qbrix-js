---
"@optiqio/qbrix": minor
---

sub-second per-call timeouts and fail-open fallback for select() (OPT-336)

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
