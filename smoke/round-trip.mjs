// runtime-agnostic smoke test: a select -> feedback round trip against the built
// esm artifact (dist/index.js), driven by an injected mock fetch so it runs
// identically on node, deno, and bun with no network. proves the same build is
// portable across runtimes.
import { QbrixClient } from "../dist/index.js";

function assert(cond, message) {
  if (!cond) throw new Error(`smoke assertion failed: ${message}`);
}

// canned wire responses in the snake_case shape proxysvc returns, so the public
// mapper (snake_case -> camelCase) is genuinely exercised.
const mockFetch = (url, init) => {
  const path = new URL(url).pathname;
  if (path.endsWith("/agent/select")) {
    assert(init.method === "POST", "select uses POST");
    const body = {
      arm: { id: "arm_a", name: "variant a", index: 0 },
      request_id: "req_smoke",
      is_default: false,
    };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  }
  if (path.endsWith("/agent/feedback")) {
    assert(init.method === "POST", "feedback uses POST");
    return Promise.resolve(new Response(JSON.stringify({ accepted: true }), { status: 201 }));
  }
  return Promise.reject(new Error(`unexpected path: ${path}`));
};

const runtime = globalThis.Deno ? "deno" : globalThis.Bun ? "bun" : "node";

try {
  const qbrix = new QbrixClient({
    apiKey: "optiq_smoke",
    baseUrl: "https://smoke.local",
    fetch: mockFetch,
  });

  const result = await qbrix.select("smoke-exp", { id: "user-1" });
  assert(result.arm.name === "variant a", `arm name, got ${result.arm.name}`);
  assert(result.arm.index === 0, `arm index, got ${result.arm.index}`);
  assert(result.requestId === "req_smoke", `requestId, got ${result.requestId}`);
  assert(result.isDefault === false, `isDefault, got ${result.isDefault}`);

  await qbrix.feedback(result.requestId, 1);

  console.log(`smoke ok: ${runtime}`);
} catch (err) {
  console.error(`smoke failed: ${runtime}`);
  console.error(err);
  throw err;
}
