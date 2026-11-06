import { cookies } from "next/headers";
import { SCHOOL_SESSION_COOKIE, TEACHER_SESSION_COOKIE } from "@/constants/auth";
import { relaySse } from "@/features/live/relay-sse";
import { buildApiUrl } from "@/services/api-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Relays the API live-update stream for the signed-in school or teacher. */
export async function GET(request: Request) {
  const jar = await cookies();
  const schoolToken = jar.get(SCHOOL_SESSION_COOKIE)?.value;
  const teacherToken = jar.get(TEACHER_SESSION_COOKIE)?.value;

  const [upstreamPath, token] = schoolToken
    ? ["/school/events", schoolToken]
    : teacherToken
      ? ["/teacher/events", teacherToken]
      : [null, undefined];
  if (!upstreamPath || !token) return new Response(null, { status: 401 });

  try {
    const upstream = await fetch(buildApiUrl(upstreamPath), {
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
