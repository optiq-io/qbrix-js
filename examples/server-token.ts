// An order webhook: credit the decisions the browser carried to the order.
//
// The browser calls qbrix.decisions("purchase") at checkout and puts the token where
// the order already carries things: a cart attribute, order metadata, a payment's
// metadata (at most four decisions fit in a 500-character value).
//
//   QBRIX_API_KEY=optiq_... QBRIX_BASE_URL=http://localhost:8080 \
//   QBRIX_DECISIONS=... npx tsx examples/server-token.ts
import { Qbrix } from "@optiqio/qbrix";

async function main(): Promise<void> {
  const qbrix = new Qbrix();
  const order = { id: `order-${Date.now()}`, decisions: process.env.QBRIX_DECISIONS };

  const tracked = await qbrix.track("purchase", 1, {
    decisions: order.decisions,
    // the order id makes a redelivered webhook count once
    id: order.id,
  });
  console.log(tracked ? `credited ${tracked.credited} decision(s)` : "no decisions to credit");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
