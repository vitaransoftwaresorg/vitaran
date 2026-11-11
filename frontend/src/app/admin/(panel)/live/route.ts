import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/constants/auth";
import { relaySse } from "@/features/live/relay-sse";
import { buildApiUrl } from "@/services/api-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Relays the API live-update stream for the signed-in admin (cookie Path=/admin). */
export async function GET(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return new Response(null, { status: 401 });

  try {
    const upstream = await fetch(buildApiUrl("/admin/events"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
      cache: "no-store",
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body) {
      return new Response(null, { status: upstream.status === 401 ? 401 : 502 });
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
