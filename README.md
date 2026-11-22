<p align="center">
  <strong>qbrix</strong> — JavaScript/TypeScript SDK for <a href="https://qbrix.io">qbrix</a>, the open-source decision engine.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@optiqio/qbrix"><img src="https://img.shields.io/npm/v/@optiqio/qbrix/next.svg?logo=npm&color=cb3837&label=next" alt="npm next"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white" alt="Node >=18">
  <img src="https://img.shields.io/badge/types-included-3178C6?logo=typescript&logoColor=white" alt="TypeScript types included">
</p>

---

> [!WARNING]
> **This is a pre-release for qbrix next.** It speaks only to a qbrix server with next switched on (`PROXY_NEXT_ENABLED=true`), and it can break between phases. `npm install @optiqio/qbrix` keeps installing the stable 0.4.x.

Built against **qbrix next · phase 2 (Full story)**, server [`optiq-io/qbrix#147`](https://github.com/optiq-io/qbrix/pull/147) and later.

A tiny, isomorphic SDK for the request path: ask a loop for a decision, render it, and report what happened. Works in the browser, Node 18+, Deno, Bun, and edge runtimes, with **zero runtime dependencies**.

## Install

```bash
npm install @optiqio/qbrix@next
```

## Quickstart

```ts
import { Qbrix } from "@optiqio/qbrix";

const qbrix = new Qbrix({ apiKey: "optiq_…", baseUrl: "https://qbrix.example.com" });
const decision = await qbrix.select(
  "checkout-headline",
  { unit: "user-1", properties: { device: "mobile" } },
  { offline: { key: "control", config: { headline: "Checkout" } } },
);
render(decision.option?.config);
await qbrix.outcome(decision.requestId, 1);
```

- **`select(loop, context, settings?)`** takes the loop's key or id. `context.unit` says who the decision is for and is required; the SDK checks it before any call. `properties` are what the app knows about the request: device, plan, country. It returns a `Decision`: the `option` to render, a `requestId`, and the `reason` it was chosen.
- **`requestId`** is there only when the decision can learn: a live loop. A draft or paused loop answers its fallback without one.
- **`outcome(requestId, value, options?)`** reports what happened after one decision. The value must fit the loop's metric (a conversion is 0 or 1). A null `requestId` sends nothing, so call it unconditionally.

## When qbrix can't be reached

`select` sits on your request path, so it never throws on the page because qbrix is down. When qbrix times out, refuses the connection, rate limits (`429`) or answers `5xx`, `select` resolves with your `settings.offline` option, `requestId: null` and reason `"offline"`. Without an `offline` option it resolves with `option: null`, so render your default.

```ts
const decision = await qbrix.select(
  "checkout-headline",
  { unit: userId },
  { offline: { key: "control", config: { headline: "Checkout" } }, timeout: 300 },
);
```

Caller errors still throw, with `offline` set or not, because they are bugs to fix: a missing `unit`, an unknown loop (`404`), an invalid context (`400`), a bad API key (`401`/`403`).

See [`examples/offline.ts`](examples/offline.ts) for a runnable version.

## Connect to your qbrix

qbrix is [open source](https://github.com/optiq-io/qbrix). Run it with the
[self-hosting guide](https://qbrix.io/docs/self-hosting), with next switched on
(`PROXY_NEXT_ENABLED=true`). Then register in the console and create an API key under
**Settings → API keys**.

Point the client at your install with `baseUrl` or `QBRIX_BASE_URL`. It is the
address of the install, not of the API path: the SDK adds `/api/...` itself.

```bash
export QBRIX_BASE_URL="http://localhost:8000"
export QBRIX_API_KEY="optiq_..."
```

| Install | `QBRIX_BASE_URL` |
|---|---|
| Docker Compose quickstart | `http://localhost:8000` (or your `CONSOLE_URL` once it's on a real host) |
| Helm chart | your ingress origin, e.g. `https://qbrix.example.com` |
| `make dev` from the qbrix repository | `http://localhost:8080` |

## Credit what happens later: `track`

An outcome often happens somewhere else: another page, an order webhook, a backend job. `track(metric, value, options?)` sends an event for a metric, and qbrix credits the decisions it belongs to.

**In the browser**, the client remembers the decisions it served, the latest per loop, until each one's window closes. Every `track` carries the ones made for its metric, on any page of the site and after a reload:

```ts
await qbrix.select("headline", { unit: visitorId });

// later, on the cart page
qbrix.track("add_to_cart", 1);
```

Events wait up to a second and go out together. When the page is hidden or left, the queue is sent at once with `keepalive`, so an event sent just before navigating away still arrives.

**To credit an order or a payment**, carry the decisions to your server and send `track` from there:

```ts
// in the browser, at checkout
const decisions = qbrix.decisions("purchase");   // put it in the cart, order or payment metadata

// in the order webhook
await qbrix.track("purchase", 1, { decisions, id: order.id });
```

`decisions(metric)` returns only the decisions made for that metric. Each one is about 115 characters, so four fit in a 500-character payment metadata value.

**For events that never passed through the browser**, send the `unit` the decision was made for: `track("revenue", 49, { unit: customerId })`.

### Consent

The browser stores decision ids and their loops in `localStorage`, and no personal data. Whether your visitors' consent covers that is your app's call. Until it does, keep decisions for the life of the page only, and switch once consent is given:

```ts
const qbrix = new Qbrix({ apiKey, storage: "memory" });

onConsent(() => qbrix.setStorage("local"));
```

`setStorage("memory")` or `setStorage("none")` removes them from the device again.

## Keys in the browser and on servers

With next switched on, an API key reaches only `select`, `outcome` and `track`, so a page can hold one. Anyone can read a key in a page, though, and send events with it. Keep revenue and other events you can't let a visitor fake on your server, with a key from an environment variable:

```ts
// route handler — runs on the server
import { Qbrix } from "@optiqio/qbrix";

const qbrix = new Qbrix({ apiKey: process.env.QBRIX_API_KEY });
```

Outside a browser the client remembers nothing (`storage: "none"`), and the events of one turn of the event loop go out together, up to 500 per request. Await `flush()` before a script exits.

## API

### `new Qbrix(options?)`

| Option | Type | Default | Env fallback |
| --- | --- | --- | --- |
| `apiKey` | `string` | — | `QBRIX_API_KEY` |
| `baseUrl` | `string` | `http://localhost:8000` | `QBRIX_BASE_URL` |
| `timeout` | `number` (ms) | `5000` | — |
| `maxRetries` | `number` | `0` | — |
| `retryOn` | `number[]` | `[429, 502, 503, 504]` | — |
| `fetch` | `typeof fetch` | runtime global | — |
| `headers` | `Record<string, string>` | `{}` | — |
| `logger` | `QbrixLogger` | console (when a level is active) | — |
| `logLevel` | `LogLevel` | `"off"` | `QBRIX_LOG`, `QBRIX_DEBUG` |
| `storage` | `"local" \| "memory" \| "none"` | `"local"` in a browser, `"none"` elsewhere | — |
| `flushInterval` | `number` (ms) | `1000` in a browser, `0` elsewhere | — |

Resolution order per option: explicit argument → environment variable → default.

### `select(loop, context, settings?)`

```ts
select(loop: string, context: Context, settings?: Settings): Promise<Decision>
```

```ts
interface Context {
  unit: string;                         // required: a user, a session, an account
  properties?: Record<string, unknown>; // what the app knows about the request
}

interface Settings {
  offline?: Option;     // answered, without throwing, when qbrix can't be reached
  timeout?: number;     // overrides the client's default timeout for this call only
  maxRetries?: number;  // overrides the client's default max retries for this call only
}

interface Decision {
  option: Option | null;     // null only when offline with no `offline` option
  requestId: string | null;  // present only when the decision can learn
  reason: Reason;            // "live", "draft", "paused", … or "offline" from the SDK
}

interface Option {
  key: string;
  name?: string;
  config: Record<string, unknown>;  // what to render
}
```

### `outcome(requestId, value, options?)`

```ts
outcome(requestId: string | null, value: number, options?: OutcomeOptions): Promise<Outcome | null>
```

```ts
interface OutcomeOptions {
  id?: string;          // makes the outcome count once; minted by the SDK when absent
  at?: Date | number;   // when it happened; the time qbrix receives it when absent
  timeout?: number;
  maxRetries?: number;
}

interface Outcome {
  id: string;
  at: Date;
}
```

Each call carries an event `id`. The SDK mints one per call when you don't pass it, and keeps it across that call's retries, so a retried outcome counts once. Pass your own `id` when the same outcome can be reported from more than one place. An invalid value throws a `BadRequestError` whose `detail` names the rule (e.g. `a conversion is 0 or 1, got 2`). Only `select` answers offline: `outcome` throws when qbrix can't be reached.

### `track(metric, value, options?)`

```ts
track(metric: string, value: number, options?: TrackOptions): Promise<Tracked | null>
```

```ts
interface TrackOptions {
  decisions?: string | null;  // a token from decisions(); the remembered ones for the metric when absent
  unit?: string;              // who it happened to, for events that carry no decisions
  id?: string;                // makes the event count once; minted by the SDK when absent
  at?: Date | number;         // when it happened; the time qbrix receives it when absent
}

interface Tracked {
  id: string;
  at: Date;
  credited: number | null;    // decisions credited; null when it waits to be matched by its unit
}
```

With no decisions to carry and no `unit`, `track` sends nothing and resolves `null`, so a page can call it before any decision was served. An event qbrix refuses rejects with its own error, e.g. a `NotFoundError` with code `METRIC_NOT_FOUND`; the rest of its batch is unaffected.

### `decisions(metric?)`

The decisions token: the remembered decisions, only those made for `metric` when given, joined into one string. `null` when there are none. Treat it as opaque.

### `setStorage(storage)` and `flush()`

`setStorage` switches where decisions are remembered. `flush()` sends every queued event now and settles when qbrix has answered.

### Errors

Every failure throws a typed error from the `QbrixError` hierarchy — catch the ones you care about with `instanceof`.

```ts
import { BadRequestError, NotFoundError, QbrixAPIError } from "@optiqio/qbrix";

try {
  await qbrix.outcome(requestId, value);
} catch (err) {
  if (err instanceof BadRequestError) {
    console.error(`qbrix refused the outcome: ${err.detail}`);
  } else if (err instanceof QbrixAPIError) {
    console.error(`qbrix ${err.status} ${err.code}: ${err.detail}`);
  }
  throw err;
}
```

- **`QbrixError`** — base class for everything thrown by the SDK, including a missing `context.unit`.
- **`QbrixAPIError`** — the server returned a non-2xx response. Carries `status`, `detail`, a machine-readable `code` (e.g. `LOOP_NOT_FOUND`, `INVALID_OUTCOME`), and optional `context`. Status-specific subclasses: `BadRequestError` (400), `AuthenticationError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `RateLimitedError` (429, adds `retryAfter`), `InternalServerError` (500), `BadGatewayError` (502), `ServiceUnavailableError` (503), `GatewayTimeoutError` (504).
- **`QbrixConnectionError`** — the request never completed (network failure).
- **`QbrixTimeoutError`** — the request exceeded `timeout`.

### Logging

The SDK is **silent by default**. Turn on logging by setting `logLevel` (`"debug" | "info" | "warn" | "error" | "off"`), injecting a `logger`, or via the `QBRIX_LOG` / `QBRIX_DEBUG` environment variables.

```ts
new Qbrix({ apiKey, logLevel: "debug" });
```

```bash
QBRIX_LOG=warn node app.js   # or QBRIX_DEBUG=1 for full debug output
```

The transport logs each request attempt and success at `debug`, retries at `warn`, and failures (give-up, timeout, connection) at `error`. Log context is limited to method, path, status, and attempt counts — it **never** includes your API key, headers, or request/response bodies.

## Runtime support

Runs unmodified on **Node 18+, Deno, Bun, edge runtimes, and the browser** — built on universal primitives (`fetch`, `AbortController`, `crypto.randomUUID()`) with zero runtime dependencies. Ships dual ESM + CJS with bundled type declarations.

## Development

```bash
npm install
npm run build      # dual ESM + CJS + .d.ts via tsup
npm run test       # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # biome
```

The wire types are generated from a vendored OpenAPI spec. To refresh it, run a qbrix server with next switched on (`make dev-next` in the qbrix repository), then:

```bash
QBRIX_BASE_URL=http://localhost:8080 npm run spec:pull && npm run generate
```

`npm run smoke:live` runs the client against such a server (after `npm run build`): draft, live, outcome, a refused value, an unknown loop, a retried outcome and the offline path.

## License

MIT
