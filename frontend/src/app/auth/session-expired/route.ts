import { NextResponse } from "next/server";
import { SCHOOL_LOGIN_PATH, SCHOOL_SESSION_COOKIE, TEACHER_SESSION_COOKIE } from "@/constants/auth";

/**
 * Expired or revoked portal token: drop the cookies before showing login, otherwise the proxy
 * (which only sees that a cookie exists) would bounce between login and the portal.
 */
export function GET() {
  // Relative Location: behind a tunnel, the request URL still reports the local host.
  const response = new NextResponse(null, { status: 307, headers: { Location: SCHOOL_LOGIN_PATH } });
  response.cookies.delete({ name: SCHOOL_SESSION_COOKIE, path: "/" });
  response.cookies.delete({ name: TEACHER_SESSION_COOKIE, path: "/" });
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  return response;
}
