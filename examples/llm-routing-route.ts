// LLM model & prompt routing — the request-path half.
//
// Backs https://qbrix.io/docs/llm-routing. Setup lives in the Python SDK or the
// console; this SDK covers select and feedback.
//
// The shape that makes this different from checkout: the reward does not exist
// when you select. A judge has to run, or a user has to react. So the requestId
// is persisted alongside the generation and fed back later.
//
//   POST /api/chat  -> encode the request, route it, store the requestId
//   (later)         -> judge the answer, report the blended reward
//
//   QBRIX_API_KEY=optiq_... QBRIX_BASE_URL=http://localhost:8080 \
//     npx tsx examples/llm-routing-route.ts
import { QbrixAPIError, QbrixClient } from "@optiqio/qbrix";

const qbrix = new QbrixClient();

const EXPERIMENT_ID = process.env.QBRIX_EXPERIMENT_ID ?? "assistant-routing";

const ROUTE_COST_USD: Record<string, number> = {
  frontier: 0.03,
  mid: 0.004,
  small: 0.0006,
};

const FALLBACK_ROUTE = "mid";
const MAX_COST_USD = 0.03;

// how much quality you will give up to save a full unit of cost. one explicit
// constant rather than a rule of thumb buried in a routing `if`.
const COST_WEIGHT = 0.25;

// must match the experiment's `dim`, on every call, for the life of the
// experiment. features are scaled into roughly [0, 1] so a token count does not
// dominate a 0/1 flag on units alone.
function encode(prompt: string, hasTools: boolean, historyTurns: number): number[] {
  return [
    Math.min(prompt.length / 4000, 1),
    hasTools ? 1 : 0,
    Math.min(historyTurns / 20, 1),
    prompt.includes("?") ? 1 : 0,
  ];
}

// bounded means bounded — the clamp is not optional.
function reward(quality: number, costUsd: number): number {
  const penalty = COST_WEIGHT * Math.min(costUsd / MAX_COST_USD, 1);
  return Math.max(0, Math.min(1, quality - penalty));
}

// stands in for your generations table.
interface Generation {
  route: string;
  costUsd: number;
  qbrixRequestId: string | null;
}
const store = new Map<string, Generation>();

export async function chat(req: Request): Promise<Response> {
  const { conversationId, prompt, hasTools, historyTurns } = (await req.json()) as {
    conversationId: string;
    prompt: string;
    hasTools?: boolean;
    historyTurns?: number;
  };

  let route = FALLBACK_ROUTE;
  let qbrixRequestId: string | null = null;

  try {
    const { arm, requestId } = await qbrix.select(EXPERIMENT_ID, {
      id: conversationId,
      vector: encode(prompt, hasTools ?? false, historyTurns ?? 0),
    });
    // an unknown arm name should degrade the cost curve, not availability.
    route = arm.name in ROUTE_COST_USD ? arm.name : FALLBACK_ROUTE;
    qbrixRequestId = requestId ?? null;
  } catch (err) {
    if (err instanceof QbrixAPIError) {
      console.error(`qbrix ${err.status} ${err.code}: ${err.detail}`);
    } else {
      console.error(err);
    }
  }

  const costUsd = ROUTE_COST_USD[route] ?? ROUTE_COST_USD[FALLBACK_ROUTE] ?? 0;
  const answer = `<answer from ${route}>`; // your provider call goes here

  // the requestId has to outlive this request — it is the only thing linking
  // the judgement to the decision.
  store.set(conversationId, { route, costUsd, qbrixRequestId });

  return Response.json({ answer, route });
}

// runs whenever the score arrives: a judge worker, a thumbs-up handler, or a
// nightly batch. minutes or hours after the selection, which is fine — the
// learner credits the decision the reward belongs to.
export async function reportJudgement(conversationId: string, quality: number): Promise<void> {
  const row = store.get(conversationId);
  if (!row?.qbrixRequestId) return;

  await qbrix.feedback(row.qbrixRequestId, reward(quality, row.costUsd));
}

async function main(): Promise<void> {
  const res = await chat(
    new Request("http://local/api/chat", {
      method: "POST",
      body: JSON.stringify({
        conversationId: "conversation-1",
        prompt: "What is the refund window on an order placed last week?",
        hasTools: false,
        historyTurns: 1,
      }),
    }),
  );
  console.log(await res.json());

  // ... the judge runs later ...
  await reportJudgement("conversation-1", 0.88);
  console.log("reported judgement for conversation-1");
}

if (process.env.QBRIX_EXAMPLE_RUN !== "0") {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
