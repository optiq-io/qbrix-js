// Handling outages — sub-second timeouts and fail-open fallback for select().
//
// Backs https://qbrix.io/docs/handling-outages. select() sits on your request
// path; this script shows the two knobs that keep it from becoming your
// incident: a tight per-call timeout, and a `fallback` arm resolved locally
// when qbrix can't be reached.
//
// Setup (pool, experiment) lives in the Python SDK, curl, or the console —
// this SDK covers select and feedback only.
//
//   1. A per-call `timeout` tighter than the client-wide default (5000ms) —
//      pass it on the call that's actually on your hot path.
//
//   2. `fallback` makes select() fail open: an unreachable proxy resolves the
//      declared arm locally (isFallback: true) instead of rejecting. The
//      second client below points at a black-hole address to simulate that
//      outage deterministically, without needing to actually take qbrix down.
//
//   3. feedback(requestId, ...) is a safe no-op whenever requestId is null —
//      which is exactly what a fallback selection returns, since there is no
//      server-minted token to report against. Call it unconditionally; don't
//      guard on isFallback yourself.
//
//   QBRIX_API_KEY=optiq_... QBRIX_BASE_URL=http://localhost:8000 \
//     npx tsx examples/handling-outages.ts
import { QbrixClient } from "@optiqio/qbrix";
import type { Arm } from "@optiqio/qbrix";

const EXPERIMENT_ID = process.env.QBRIX_EXPERIMENT_ID ?? "homepage-cta";

// a port nothing listens on: connection is refused immediately, so the
// "outage" below is deterministic and doesn't depend on an external host.
const UNREACHABLE_BASE_URL = "http://127.0.0.1:1";

// the arm to serve when qbrix can't be reached — pick something safe to show
// everyone with no context, not last week's leader.
const FALLBACK_ARM: Arm = { id: "arm_control", name: "control", index: 0 };

async function main(): Promise<void> {
  const qbrix = new QbrixClient();
  // simulates "qbrix is unreachable" deterministically. in production
  // there's no second client — the same client just fails to connect.
  const unreachable = new QbrixClient({ baseUrl: UNREACHABLE_BASE_URL, timeout: 300 });

  let resolved = 0;
  let fellBack = 0;

  for (let i = 0; i < 20; i++) {
    // every third session simulates an outage.
    const client = i % 3 === 0 ? unreachable : qbrix;

    const result = await client.select(
      EXPERIMENT_ID,
      { id: `session-${String(i).padStart(4, "0")}` },
      { timeout: 300, fallback: FALLBACK_ARM },
    );

    if (result.isFallback) {
      fellBack++;
      console.log(`  session-${i} -> fallback (${result.arm.name})`);
    } else {
      resolved++;
      console.log(`  session-${i} -> ${result.arm.name} (live)`);
    }

    // safe unconditionally: a no-op when requestId is null, which is exactly
    // what the fallback branch above returns.
    await client.feedback(result.requestId, 1.0);
  }

  console.log(
    `\n${resolved} resolved live, ${fellBack} failed open to "${FALLBACK_ARM.name}" — feedback() no-op'd for every one of the ${fellBack} fallback selections, since none had a requestId.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
