// live smoke for the request path against a qbrix server with next switched on
// (PROXY_NEXT_ENABLED=true). creates a metric and a draft loop over raw http, then
// runs the built client (dist/index.js) through draft, live, outcome, a refused
// value, an unknown loop, a retried outcome and the offline path. not run in ci.
//
//   npm run build && QBRIX_BASE_URL=http://localhost:8080 QBRIX_API_KEY=optiq_... npm run smoke:live
import { BadRequestError, NotFoundError, Qbrix, QbrixError } from "../dist/index.js";

const BASE_URL = (process.env.QBRIX_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const API_KEY = process.env.QBRIX_API_KEY;
const RUN_ID = crypto.randomUUID().slice(0, 8);
const CONFIG = { headline: "Pay now", size: 3, ratio: 0.5 };
const OFFLINE = { key: "offline", config: { headline: "Checkout" } };

function assert(cond, message) {
  if (!cond) throw new Error(`live smoke failed: ${message}`);
}

function ok(message) {
  console.log(`  ok  ${message}`);
}

async function api(path, body) {
  const headers = { "Content-Type": "application/json", ...(API_KEY && { "X-API-Key": API_KEY }) };
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function rejection(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error("live smoke failed: expected a rejection");
}

const metric = `smoke-purchase-${RUN_ID}`;
await api("/api/v1/metrics", { name: metric, semantic: "a purchase", type: "conversion" });
const loop = await api("/api/v1/loops", {
  name: `smoke headline ${RUN_ID}`,
  metric,
  options: [
    { key: "control", name: "Control", config: { headline: "Buy" } },
    { key: "bold", name: "Bold", config: CONFIG },
  ],
  fallback: "control",
});
console.log(`loop ${loop.key} on ${BASE_URL}`);

const qbrix = new Qbrix({ apiKey: API_KEY, baseUrl: BASE_URL });

const draft = await qbrix.select(loop.key, { unit: "u-draft" });
assert(draft.reason === "draft", `draft reason, got ${draft.reason}`);
assert(draft.requestId === null, "draft has no requestId");
assert(draft.option?.key === "control", `draft answers the fallback, got ${draft.option?.key}`);
assert((await qbrix.outcome(draft.requestId, 1)) === null, "outcome on a draft sends nothing");
ok(`draft → ${draft.option.key}, no requestId`);

await api(`/api/v1/loops/${loop.key}/launch`, {});

const decision = await qbrix.select(loop.key, { unit: "u-live", properties: { device: "mobile" } });
assert(decision.reason === "live", `live reason, got ${decision.reason}`);
assert(decision.requestId, "live has a requestId");
if (decision.option?.key === "bold") {
  assert(JSON.stringify(decision.option.config) === JSON.stringify(CONFIG), "bold config");
}
ok(`live → ${decision.option?.key} ${JSON.stringify(decision.option?.config)}`);

const outcome = await qbrix.outcome(decision.requestId, 1);
assert(outcome?.id && outcome.at instanceof Date, "outcome accepted");
ok(`outcome accepted as ${outcome.id} at ${outcome.at.toISOString()}`);

const refused = await rejection(qbrix.outcome(decision.requestId, 2));
assert(refused instanceof BadRequestError && refused.code === "INVALID_OUTCOME", `${refused}`);
ok(`outcome 2 refused: ${refused.detail}`);

const unknown = await rejection(qbrix.select(`no-such-loop-${RUN_ID}`, { unit: "u" }));
assert(unknown instanceof NotFoundError, `${unknown}`);
ok(`unknown loop: ${unknown.detail}`);

const noUnit = await rejection(qbrix.select(loop.key, {}, { offline: OFFLINE }));
assert(noUnit instanceof QbrixError, `${noUnit}`);
ok(`missing unit: ${noUnit.message}`);

const sentIds = [];
let failedOnce = false;
const flaky = new Qbrix({
  apiKey: API_KEY,
  baseUrl: BASE_URL,
  maxRetries: 1,
  retryOn: [503],
  fetch: async (url, init) => {
    sentIds.push(JSON.parse(init.body).id);
    if (!failedOnce) {
      failedOnce = true;
      return new Response("{}", { status: 503 });
    }
    return fetch(url, init);
  },
});
const second = await qbrix.select(loop.key, { unit: "u-retry" });
const retried = await flaky.outcome(second.requestId, 0);
assert(sentIds.length === 2 && sentIds[0] === sentIds[1], `ids ${sentIds}`);
assert(retried?.id === sentIds[0], "the accepted id is the minted one");
ok(`retried outcome sent ${sentIds[0]} twice`);

const down = new Qbrix({ apiKey: "optiq_x", baseUrl: "http://127.0.0.1:1", timeout: 500 });
const offline = await down.select(loop.key, { unit: "u" }, { offline: OFFLINE });
assert(
  offline.reason === "offline" && offline.option === OFFLINE && offline.requestId === null,
  "offline",
);
const bare = await down.select(loop.key, { unit: "u" });
assert(bare.reason === "offline" && bare.option === null, "offline without an option");
ok("unreachable → offline option, or option null");

console.log(`live smoke ok: outcome ids ${outcome.id}, ${retried.id}`);
