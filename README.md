<p align="center">
  <strong>qbrix</strong> — JavaScript/TypeScript SDK for the <a href="https://qbrix.io">Qbrix</a> platform.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/qbrix"><img src="https://img.shields.io/npm/v/qbrix.svg?logo=npm&color=cb3837" alt="npm version"></a>
  <img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/eskinmi/COVERAGE_GIST_ID/raw/qbrix-js-coverage.json" alt="Coverage">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white" alt="Node >=18">
  <img src="https://img.shields.io/badge/types-included-3178C6?logo=typescript&logoColor=white" alt="TypeScript types included">
</p>

---

A tiny, isomorphic SDK for multi-armed-bandit **selection** and **feedback** — `select` an arm, render it, report a `reward`. Works in the browser, Node 18+, Deno, Bun, and edge runtimes, with **zero runtime dependencies**.

## Install

```bash
npm install qbrix
```

## Quickstart

```ts
import { QbrixClient } from "qbrix";

const qbrix = new QbrixClient({ apiKey: process.env.QBRIX_API_KEY });

// 1. select an arm for this user/context
const { arm, requestId } = await qbrix.select("homepage-cta", { id: "user-42" });

// 2. render the chosen arm
console.log(`showing: ${arm.name}`);

// 3. report the outcome — pass back the requestId from select
await qbrix.feedback(requestId, 1.0); // e.g. 1 = converted, 0 = no action
```

`select` returns the chosen `arm`, a `requestId`, and `isDefault`. The `requestId` is the handle that ties a later `feedback` call back to the decision — hold onto it.

## Use it server-side

> [!IMPORTANT]
> Your API key (`optiq_…`) is a **secret**. The SDK sends it as an `X-API-Key` header, so anywhere the client runs, the key goes too. **Bundling it into browser code exposes it to every visitor.** Run `qbrix` on a server (route handler, edge function, backend) and keep the key in an environment variable. Have the browser call _your_ endpoint, not Qbrix directly.

The recommended pattern is a thin server-side handler — the key never reaches the client:

```ts
// edge / route handler — runs on the server
import { QbrixClient } from "qbrix";

const qbrix = new QbrixClient({ apiKey: process.env.QBRIX_API_KEY });

export default async function handler(req: Request): Promise<Response> {
  const { userId } = await req.json();
  const { arm, requestId } = await qbrix.select("homepage-cta", { id: userId });
  return Response.json({ arm, requestId });
}
```

See [`examples/edge-route.ts`](examples/edge-route.ts) and [`examples/node-quickstart.ts`](examples/node-quickstart.ts) for runnable versions.

**Browser usage** is supported for trusted or low-stakes contexts (internal tools, prototypes), but it is a deliberate trade-off: a key shipped to the browser is public. Prefer a server-side proxy for anything user-facing.

## API

### `new QbrixClient(options?)`

| Option | Type | Default | Env fallback |
| --- | --- | --- | --- |
| `apiKey` | `string` | — | `QBRIX_API_KEY` |
| `baseUrl` | `string` | `http://localhost:8080` | `QBRIX_BASE_URL` |
| `timeout` | `number` (ms) | `30000` | — |
| `maxRetries` | `number` | `2` | — |
| `retryOn` | `number[]` | `[429, 502, 503, 504]` | — |
| `fetch` | `typeof fetch` | runtime global | — |
| `headers` | `Record<string, string>` | `{}` | — |

Resolution order per option: explicit argument → environment variable → default.

### `select(experimentId, context)`

```ts
select(experimentId: string, context: Context): Promise<SelectResult>
```

```ts
interface Context {
  id: string;                          // required — a stable user/session identifier
  vector?: number[];                   // optional feature vector
  metadata?: Record<string, unknown>;  // optional arbitrary attributes
}

interface SelectResult {
  arm: { id: string; name: string; index: number };
  requestId: string;   // pass this back into feedback()
  isDefault: boolean;  // true when the platform returned the fallback arm
}
```

### `feedback(requestId, reward)`

```ts
feedback(requestId: string, reward: number): Promise<void>
```

Reports the outcome for a prior `select`. `requestId` is the value returned by that `select`; `reward` is the observed signal (e.g. `1` for a conversion, `0` for none — any numeric reward your experiment defines).

### Errors

Every failure throws a typed error from the `QbrixError` hierarchy — catch the ones you care about with `instanceof`.

```ts
import {
  QbrixAPIError,
  RateLimitedError,
  AuthenticationError,
  QbrixTimeoutError,
} from "qbrix";

try {
  const { arm, requestId } = await qbrix.select("homepage-cta", { id: "user-42" });
} catch (err) {
  if (err instanceof RateLimitedError) {
    console.warn(`rate limited; retry after ${err.retryAfter}s`);
  } else if (err instanceof AuthenticationError) {
    throw new Error("check your QBRIX_API_KEY");
  } else if (err instanceof QbrixTimeoutError) {
    // request exceeded `timeout`
  } else if (err instanceof QbrixAPIError) {
    console.error(`qbrix ${err.status} ${err.code}: ${err.detail}`);
  }
  throw err;
}
```

- **`QbrixError`** — base class for everything thrown by the SDK.
- **`QbrixAPIError`** — the proxy returned a non-2xx response. Carries `status`, `detail`, a machine-readable `code`, and optional `context`. Status-specific subclasses: `BadRequestError` (400), `AuthenticationError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `RateLimitedError` (429, adds `retryAfter`), `InternalServerError` (500), `BadGatewayError` (502), `ServiceUnavailableError` (503), `GatewayTimeoutError` (504).
- **`QbrixConnectionError`** — the request never completed (network failure).
- **`QbrixTimeoutError`** — the request exceeded `timeout`.

## Runtime support

Runs unmodified on **Node 18+, Deno, Bun, edge runtimes, and the browser** — built on universal primitives (`fetch`, `AbortController`) with zero runtime dependencies. Ships dual ESM + CJS with bundled type declarations.

Full documentation: [qbrix.io/docs](https://qbrix.io/docs).

## Development

```bash
npm install
npm run build      # dual ESM + CJS + .d.ts via tsup
npm run test       # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # biome
```

## License

MIT
