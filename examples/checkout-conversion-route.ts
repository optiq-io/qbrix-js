// Checkout & CTA conversion — the request-path half.
//
// Backs https://qbrix.io/docs/checkout-conversion. Setup (pool, experiment,
// gate) is a one-time act and lives in the Python SDK, curl, or the console —
// this SDK covers the hot path only: select and feedback.
//
// Two handlers, because the decision and its outcome are different requests:
//
//   POST /api/cta       -> select a variant, return copy + requestId
//   POST /api/purchased -> report the outcome against that requestId
//
// The signature is the web-standard (Request) -> (Response) handler used by
// edge runtimes (vercel, cloudflare workers, deno deploy) and node route
// handlers.
//
//   QBRIX_API_KEY=optiq_... QBRIX_BASE_URL=http://localhost:8000 \
//     npx tsx examples/checkout-conversion-route.ts
import { QbrixAPIError, QbrixClient } from "@optiqio/qbrix";

// the key lives here and only here. the browser posts an identifier to this
// handler and gets back a variant — it never sees the key or the experiment.
const qbrix = new QbrixClient();

const EXPERIMENT_ID = process.env.QBRIX_EXPERIMENT_ID ?? "checkout-cta-conversion";

// arm.name -> what to render. the selection response carries {id, name, index}
// and no metadata: it is the hot path, so it stays small. the behaviour behind
// a name is yours to hold.
const CTA_COPY: Record<string, string> = {
  control: "Complete purchase",
  urgency: "Complete purchase — 2 left",
  "social-proof": "Join 12,000 buyers",
};

const FALLBACK_COPY = CTA_COPY.control as string;

export async function selectCta(req: Request): Promise<Response> {
  let userId: unknown;
  try {
    ({ userId } = (await req.json()) as { userId?: unknown });
  } catch {
    return Response.json({ error: "invalid json body" }, { status: 400 });
  }

  if (typeof userId !== "string") {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    // context.id is required, and it is what a feature gate buckets on — so a
    // visitor inside a 20% rollout on one page load stays inside it on the next.
    const { arm, requestId } = await qbrix.select(EXPERIMENT_ID, { id: userId });

    // an unknown name falls back to control rather than throwing. that is what
    // protects the checkout the day someone renames an arm in the console.
    return Response.json({
      copy: CTA_COPY[arm.name] ?? FALLBACK_COPY,
      // null when the experiment is paused — no feedback token was minted, so
      // the client has nothing to report against. persist it only if present.
      requestId: requestId ?? null,
    });
  } catch (err) {
    // never let optimization take the checkout down: serve control and move on.
    if (err instanceof QbrixAPIError) {
      console.error(`qbrix ${err.status} ${err.code}: ${err.detail}`);
    } else {
      console.error(err);
    }
    return Response.json({ copy: FALLBACK_COPY, requestId: null });
  }
}

export async function reportPurchase(req: Request): Promise<Response> {
  const { requestId } = (await req.json()) as { requestId?: string | null };

  // the selection that produced this requestId happened minutes ago, on a
  // different request. no requestId means the experiment was paused then, or
  // this session never saw a variant — either way there is nothing to credit.
  if (!requestId) {
    return Response.json({ recorded: false });
  }

  await qbrix.feedback(requestId, 1.0);
  return Response.json({ recorded: true });
}

// a tiny round trip so the file runs on its own, not just as an import.
async function main(): Promise<void> {
  const selected = await selectCta(
    new Request("http://local/api/cta", {
      method: "POST",
      body: JSON.stringify({ userId: "user-42" }),
    }),
  );
  const { copy, requestId } = (await selected.json()) as {
    copy: string;
    requestId: string | null;
  };
  console.log(`rendered ${JSON.stringify(copy)} (requestId ${requestId})`);

  const reported = await reportPurchase(
    new Request("http://local/api/purchased", {
      method: "POST",
      body: JSON.stringify({ requestId }),
    }),
  );
  console.log(await reported.json());
}

if (process.env.QBRIX_EXAMPLE_RUN !== "0") {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
