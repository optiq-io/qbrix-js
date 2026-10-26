// runtime-agnostic smoke test: a select -> outcome round trip against the built
// esm artifact (dist/index.js), driven by an injected mock fetch so it runs
// identically on node, deno, and bun with no network. proves the same build is
// portable across runtimes.
import { Qbrix } from "../dist/index.js";

function assert(cond, message) {
  if (!cond) throw new Error(`smoke assertion failed: ${message}`);
}

let outcomeBody;

// canned wire responses in the snake_case shape proxysvc returns, so the public
// mapper (snake_case -> camelCase) is genuinely exercised.
const mockFetch = (url, init) => {
  const path = new URL(url).pathname;
  if (path === "/api/v1/select") {
    assert(init.method === "POST", "select uses POST");
    const body = {
      option: { key: "bold", name: "Bold", config: { headline: "Pay now" } },
      request_id: "req_smoke",
      reason: "live",
    };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  }
  if (path === "/api/v1/outcome") {
    assert(init.method === "POST", "outcome uses POST");
    outcomeBody = JSON.parse(init.body);
    const body = { id: outcomeBody.id, at: "2026-10-26T12:00:00Z" };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 202 }));
  }
  return Promise.reject(new Error(`unexpected path: ${path}`));
};

const runtime = globalThis.Deno ? "deno" : globalThis.Bun ? "bun" : "node";

try {
  const qbrix = new Qbrix({
    apiKey: "optiq_smoke",
    baseUrl: "https://smoke.local",
    fetch: mockFetch,
  });

  const decision = await qbrix.select("smoke-loop", { unit: "user-1" });
  assert(decision.option?.config.headline === "Pay now", `config, got ${decision.option?.config}`);
  assert(decision.requestId === "req_smoke", `requestId, got ${decision.requestId}`);
  assert(decision.reason === "live", `reason, got ${decision.reason}`);

  const outcome = await qbrix.outcome(decision.requestId, 1);
  assert(outcome?.id && outcome.id === outcomeBody.id, "outcome echoes the minted id");
  assert(outcome.at instanceof Date, "outcome at is a Date");

  const down = new Qbrix({
    baseUrl: "https://smoke.local",
    fetch: () => Promise.reject(new TypeError("fetch failed")),
  });
  const offline = { key: "control", config: { headline: "Checkout" } };
  const fallback = await down.select("smoke-loop", { unit: "user-1" }, { offline });
  assert(fallback.option === offline && fallback.reason === "offline", "offline answer");
  assert((await down.outcome(fallback.requestId, 1)) === null, "outcome(null) sends nothing");

  console.log(`smoke ok: ${runtime}`);
} catch (err) {
  console.error(`smoke failed: ${runtime}`);
  console.error(err);
  throw err;
}
