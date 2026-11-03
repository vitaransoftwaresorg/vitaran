import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_BASE_PATH,
  ADMIN_LOGIN_PATH,
  ADMIN_LOGOUT_PATH,
  ADMIN_SESSION_COOKIE,
  RETURN_TO_COOKIE,
  SCHOOL_BASE_PATH,
  SCHOOL_HOME_PATH,
  SCHOOL_LOGIN_PATH,
  SCHOOL_SESSION_COOKIE,
  TEACHER_BASE_PATH,
  TEACHER_HOME_PATH,
  TEACHER_SESSION_COOKIE,
} from "@/constants/auth";

/** Shared school + teacher portal login. */
const PORTAL_LOGIN_PATH = SCHOOL_LOGIN_PATH;

function redirectToLogin(request: NextRequest, loginPath: string) {
  const { pathname, search } = request.nextUrl;
  if (pathname === loginPath || pathname === "/teacher/login") {
    return NextResponse.next();
  }

  const response = NextResponse.redirect(new URL(loginPath, request.nextUrl));
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.cookies.set(RETURN_TO_COOKIE, pathname + search, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}

function adminResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

/** Prefer school portal routes when only a school session exists. */
function schoolPortalPath(pathname: string): string {
  if (pathname.startsWith("/teacher/resources") || pathname.startsWith("/teachers-resources")) {
    return "/school/resources";
  }
  if (pathname.startsWith("/teacher/answer-keys") || pathname.startsWith("/answer-keys")) {
    return "/school/answer-keys";
  }
  if (pathname.startsWith("/teacher/results") || pathname.startsWith("/results")) {
    return "/school/results";
  }
  if (pathname.startsWith("/teacher")) {
    return SCHOOL_HOME_PATH;
  }
  return SCHOOL_HOME_PATH;
}

// Optimistic cookie checks only; pages verify the session with the API.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSchool = request.cookies.has(SCHOOL_SESSION_COOKIE);
  const hasTeacher = request.cookies.has(TEACHER_SESSION_COOKIE);

  if (pathname.startsWith(ADMIN_BASE_PATH)) {
    if (
      pathname === ADMIN_LOGIN_PATH ||
      pathname === ADMIN_LOGOUT_PATH ||
      request.cookies.has(ADMIN_SESSION_COOKIE)
    ) {
      return adminResponse(NextResponse.next());
    }
    return adminResponse(
      NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.nextUrl)),
    );
  }

  // Already signed in → never show the portal login form.
  if (pathname === PORTAL_LOGIN_PATH || pathname === "/teacher/login") {
    if (hasSchool) {
      return NextResponse.redirect(new URL(SCHOOL_HOME_PATH, request.nextUrl));
    }
    if (hasTeacher) {
      return NextResponse.redirect(new URL(TEACHER_HOME_PATH, request.nextUrl));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith(SCHOOL_BASE_PATH)) {
    if (hasSchool) return NextResponse.next();
    return redirectToLogin(request, PORTAL_LOGIN_PATH);
  }

  if (pathname.startsWith(TEACHER_BASE_PATH)) {
    if (hasTeacher) return NextResponse.next();
    // School session: send to the matching school page instead of the login form.
    if (hasSchool) {
      return NextResponse.redirect(new URL(schoolPortalPath(pathname), request.nextUrl));
    }
    return redirectToLogin(request, PORTAL_LOGIN_PATH);
  }

  // Legacy public content pages → teacher portal, or school if only school is signed in.
  if (hasTeacher) return NextResponse.next();
  if (hasSchool) {
    return NextResponse.redirect(new URL(schoolPortalPath(pathname), request.nextUrl));
  }
  return redirectToLogin(request, PORTAL_LOGIN_PATH);
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/school",
    "/school/:path*",
    "/teacher",
    "/teacher/:path*",
    "/teachers-resources",
    "/teachers-resources/:path*",
    "/answer-keys",
    "/answer-keys/:path*",
    "/results",
    "/results/:path*",
  ],
};
