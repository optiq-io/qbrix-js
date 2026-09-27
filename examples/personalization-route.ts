// Personalization by segment — a declared context schema, no encoding by hand.
//
// Backs https://qbrix.io/docs/personalization-by-segment. Setup (pool,
// experiment, and the context schema itself) is a one-time act and lives in the
// Python SDK, curl, or the console — this SDK covers the hot path only.
//
//   POST /api/hero       -> select a treatment from who the visitor is
//   POST /api/converted  -> report the outcome against that requestId
//
// The point of this file: everything the strategy learns from is read straight
// off the incoming request. There is no encode() here, no fixed-width float
// array, and no shared constant that both ends have to agree on. You declared
// the shape once when you created the experiment; here you just send values.
//
// The width, the one-hot slots, the `other` bucket for a value the schema has
// never seen, and the normalisation of a number into its declared range are all
// the server's problem.
//
//   QBRIX_API_KEY=optiq_... QBRIX_BASE_URL=http://localhost:8000 \
//     npx tsx examples/personalization-route.ts
import { QbrixAPIError, QbrixClient } from "@optiqio/qbrix";

const qbrix = new QbrixClient();

const EXPERIMENT_ID = process.env.QBRIX_EXPERIMENT_ID ?? "checkout-personalization";

const HERO_COPY: Record<string, string> = {
  standard: "Checkout",
  express: "Buy it now — one tap",
  installments: "Pay in 4 interest-free payments",
};

const FALLBACK_COPY = HERO_COPY.standard as string;

// the edge already knows most of this. a geo header, a device hint, a cookie —
// values you have anyway, named the way you would name them in a log line.
function visitorProperties(req: Request, cartValue: number, returning: boolean) {
  const ua = req.headers.get("user-agent") ?? "";
  return {
    device: /mobile|android|iphone/i.test(ua) ? "mobile" : "desktop",
    // cloudflare and vercel both surface a country header. a country the schema
    // never declared is scored into a reserved `other` slot, not rejected —
    // your traffic is allowed to surprise you.
    country: req.headers.get("cf-ipcountry") ?? req.headers.get("x-vercel-ip-country") ?? "US",
    cartValue,
    returning,
  };
}

export async function selectHero(req: Request): Promise<Response> {
  let userId: unknown;
  let cartValue: unknown;
  let returning: unknown;
  try {
    ({ userId, cartValue, returning } = (await req.json()) as {
      userId?: unknown;
      cartValue?: unknown;
      returning?: unknown;
    });
  } catch {
    return Response.json({ error: "invalid json body" }, { status: 400 });
  }

  if (typeof userId !== "string") {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const { arm, requestId } = await qbrix.select(EXPERIMENT_ID, {
      id: userId,
      // named values, sent as they are. numbers stay numbers — cartValue is
      // declared numeric server-side and normalised against its range there,
      // so stringifying it here would fail the encode.
      properties: visitorProperties(
        req,
        typeof cartValue === "number" ? cartValue : 0,
        returning === true,
      ),
    });

    return Response.json({
      copy: HERO_COPY[arm.name] ?? FALLBACK_COPY,
      // null when the experiment is paused: an arm still came back, but no
      // feedback token was minted, so there is nothing to report against.
      requestId,
    });
  } catch (err) {
    // a rejected context is a 400 with INVALID_CONTEXT_PROPERTIES and a detail
    // naming what went wrong — a value of the wrong type for its declared kind,
    // a name the schema never declared, or a vector sent alongside properties.
    // an undeclared *value* of a declared categorical is not an error: it lands
    // in the reserved `other` slot. in production, still serve the page.
    if (err instanceof QbrixAPIError) {
      console.error(`qbrix ${err.status} ${err.code}: ${err.detail}`);
    } else {
      console.error(err);
    }
    return Response.json({ copy: FALLBACK_COPY, requestId: null });
  }
}

export async function reportConversion(req: Request): Promise<Response> {
  const { requestId } = (await req.json()) as { requestId?: string | null };

  if (!requestId) {
    return Response.json({ recorded: false });
  }

  await qbrix.feedback(requestId, 1.0);
  return Response.json({ recorded: true });
}

// a tiny round trip so the file runs on its own, not just as an import.
async function main(): Promise<void> {
  const selected = await selectHero(
    new Request("http://local/api/hero", {
      method: "POST",
      headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
      body: JSON.stringify({ userId: "user-42", cartValue: 62.5, returning: false }),
    }),
  );
  const { copy, requestId } = (await selected.json()) as {
    copy: string;
    requestId: string | null;
  };
  console.log(`rendered ${JSON.stringify(copy)} (requestId ${requestId})`);

  const reported = await reportConversion(
    new Request("http://local/api/converted", {
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
