// A nightly job: send what happened to each unit, for events that never passed
// through a device holding decisions. The events of one turn go out together, up to
// 500 per request.
//
//   QBRIX_API_KEY=optiq_... QBRIX_BASE_URL=http://localhost:8080 npx tsx examples/backend-job.ts
import { Qbrix } from "@optiqio/qbrix";

const renewals = [
  { customer: "customer-1", amount: 49, renewedAt: "2026-11-21T09:12:00Z" },
  { customer: "customer-2", amount: 99, renewedAt: "2026-11-21T14:40:00Z" },
];

async function main(): Promise<void> {
  const qbrix = new Qbrix();

  const results = await Promise.allSettled(
    renewals.map((renewal) =>
      qbrix.track("revenue", renewal.amount, {
        unit: renewal.customer,
        at: new Date(renewal.renewedAt),
        id: `renewal-${renewal.customer}-${renewal.renewedAt}`,
      }),
    ),
  );
  for (const [i, result] of results.entries()) {
    const customer = renewals[i]?.customer;
    console.log(customer, result.status === "fulfilled" ? "recorded" : result.reason);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
