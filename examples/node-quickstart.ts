// runnable node quickstart: select -> render -> feedback.
//
//   QBRIX_API_KEY=optiq_... QBRIX_BASE_URL=http://localhost:8080 \
//     npx tsx examples/node-quickstart.ts
//
// apiKey and baseUrl fall back to the QBRIX_API_KEY / QBRIX_BASE_URL env vars,
// so no options are needed when those are set.
import { QbrixAPIError, QbrixClient } from "qbrix";

async function main(): Promise<void> {
  const qbrix = new QbrixClient();

  // select an arm for this user/context — context.id is required.
  const { arm, requestId, isDefault } = await qbrix.select("homepage-cta", {
    id: "user-42",
  });

  console.log(`selected arm "${arm.name}" (index ${arm.index})${isDefault ? " [default]" : ""}`);

  // ... render the arm and observe the outcome ...
  const reward = 1.0; // e.g. 1 = converted, 0 = no action

  // report the outcome, tying it back to the decision via requestId.
  await qbrix.feedback(requestId, reward);
  console.log(`reported reward ${reward} for request ${requestId}`);
}

main().catch((err) => {
  if (err instanceof QbrixAPIError) {
    console.error(`qbrix ${err.status} ${err.code}: ${err.detail}`);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
