// recommended pattern: run qbrix on the server so the api key never reaches the
// browser. the client posts a userId to this handler; the handler holds the
// secret key and returns only the selected arm + requestId.
//
// the signature is the web-standard (Request) -> (Response) handler used by edge
// runtimes (vercel, cloudflare workers, deno deploy) and node route handlers.
import { QbrixAPIError, QbrixClient } from "@optiqio/qbrix";

const qbrix = new QbrixClient({ apiKey: process.env.QBRIX_API_KEY });

export default async function handler(req: Request): Promise<Response> {
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
    const { arm, requestId } = await qbrix.select("homepage-cta", { id: userId });
    // return only what the browser needs — never the api key.
    return Response.json({ arm, requestId });
  } catch (err) {
    if (err instanceof QbrixAPIError) {
      return Response.json({ error: err.code ?? "qbrix_error" }, { status: err.status });
    }
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
