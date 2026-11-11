import { NextResponse } from "next/server";
import {
  ADMIN_BASE_PATH,
  ADMIN_LOGIN_PATH,
  ADMIN_SESSION_COOKIE,
} from "@/constants/auth";

export const dynamic = "force-dynamic";

function expiredAdminCookie(path: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_SESSION_COOKIE}=; Path=${path}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}`;
}

export async function GET() {
  // Relative Location: behind a tunnel, request.url still reports the local host.
  const response = new NextResponse(null, { status: 303, headers: { Location: ADMIN_LOGIN_PATH } });
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  // NextResponse.cookies.set is keyed by name, so Path=/ would overwrite Path=/admin.
  response.headers.append("Set-Cookie", expiredAdminCookie(ADMIN_BASE_PATH));
  response.headers.append("Set-Cookie", expiredAdminCookie("/"));
  return response;
}
