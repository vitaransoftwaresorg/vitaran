import { relaySse } from "@/features/live/relay-sse";
import { buildApiUrl } from "@/services/api-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Relays anonymous settings events so public/private toggles apply site-wide instantly. */
export async function GET(request: Request) {
  try {
    const upstream = await fetch(buildApiUrl("/public/events"), {
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body) {
      return new Response(null, { status: 502 });
    }
    return relaySse(upstream, request.signal);
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    return new Response(null, { status: 502 });
  }
}
