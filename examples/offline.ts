// When qbrix can't be reached: a tight timeout, and the app's own offline option.
//
// select() sits on your request path. Give it a timeout your page can afford and an
// offline option that is safe to show everyone. When qbrix times out, refuses the
// connection, rate limits or answers 5xx, select() resolves with that option and
// reason "offline" instead of throwing. outcome() on that decision sends nothing,
// so call it unconditionally.
//
// The client below points at a port nothing listens on, so the outage is
// deterministic.
//
//   npx tsx examples/offline.ts
import { Qbrix } from "@optiqio/qbrix";
import type { Option } from "@optiqio/qbrix";

const OFFLINE: Option = { key: "control", config: { headline: "Checkout" } };

async function main(): Promise<void> {
  const qbrix = new Qbrix({ apiKey: "optiq_example", baseUrl: "http://127.0.0.1:1" });

  const decision = await qbrix.select(
    "checkout-headline",
    { unit: "user-1" },
    { offline: OFFLINE, timeout: 300 },
  );
  console.log(`${decision.reason}: ${decision.option?.key}`, decision.option?.config);

  await qbrix.outcome(decision.requestId, 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
