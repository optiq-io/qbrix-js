// Ask a loop for a decision, render it, and report what happened.
//
// Needs a qbrix server with next switched on (PROXY_NEXT_ENABLED=true) and a loop
// whose key is QBRIX_LOOP. A draft loop answers its fallback with no requestId, so
// outcome() sends nothing until the loop is launched.
//
//   QBRIX_API_KEY=optiq_... QBRIX_BASE_URL=http://localhost:8000 QBRIX_LOOP=checkout-headline \
//     npx tsx examples/quickstart.ts
import { Qbrix } from "@optiqio/qbrix";

const LOOP = process.env.QBRIX_LOOP ?? "checkout-headline";

async function main(): Promise<void> {
  const qbrix = new Qbrix();

  const decision = await qbrix.select(
    LOOP,
    { unit: "user-1", properties: { device: "mobile" } },
    { offline: { key: "control", config: { headline: "Checkout" } } },
  );
  console.log(`${decision.reason}: ${decision.option?.key}`, decision.option?.config);

  const outcome = await qbrix.outcome(decision.requestId, 1);
  console.log(
    outcome ? `outcome ${outcome.id} at ${outcome.at.toISOString()}` : "nothing to learn",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
