---
"@optiqio/qbrix": minor
---

send named context properties instead of a hand-encoded vector (OPT-389)

`Context` gains `properties` — plain named values like `{ device: "mobile", price: 20 }`,
encoded server-side against the schema the experiment declares. No fixed-width float
array, and no encoder shared between your app and qbrix.

```ts
await qbrix.select("checkout-personalization", {
  id: userId,
  properties: { device: "mobile", country: "DE", cartValue: 62.5, returning: true },
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
