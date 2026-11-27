import { NextResponse } from "next/server";
import {
  ADMIN_BASE_PATH,
  ADMIN_SESSION_COOKIE,
  HEAD_OFFICE_SESSION_COOKIE,
  SCHOOL_LOGIN_PATH,
  SCHOOL_SESSION_COOKIE,
  TEACHER_SESSION_COOKIE,
} from "@/constants/auth";

function expiredCookie(name: string, path: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=; Path=${path}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}`;
}

/**
 * Expired or revoked portal token: drop the cookies before showing login, otherwise the proxy
 * (which only sees that a cookie exists) would bounce between login and the portal.
 */
export function GET() {
  // Relative Location: behind a tunnel/proxy, request.url still reports the local host.
  const response = new NextResponse(null, { status: 307, headers: { Location: SCHOOL_LOGIN_PATH } });
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  // NextResponse.cookies.set is keyed by name — append so Path=/ and legacy Path=/admin both clear.
  response.headers.append("Set-Cookie", expiredCookie(SCHOOL_SESSION_COOKIE, "/"));
  response.headers.append("Set-Cookie", expiredCookie(TEACHER_SESSION_COOKIE, "/"));
  response.headers.append("Set-Cookie", expiredCookie(HEAD_OFFICE_SESSION_COOKIE, "/"));
  response.headers.append("Set-Cookie", expiredCookie(ADMIN_SESSION_COOKIE, "/"));
  response.headers.append("Set-Cookie", expiredCookie(ADMIN_SESSION_COOKIE, ADMIN_BASE_PATH));
  return response;
}
