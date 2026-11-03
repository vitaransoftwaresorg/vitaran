import "server-only";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { auth, signOut } from "@/auth";
import {
  GOOGLE_PORTAL_COOKIE,
  SCHOOL_HOME_PATH,
  SCHOOL_LOGIN_PATH,
  TEACHER_HOME_PATH,
  RETURN_TO_COOKIE,
  safePortalReturnPath,
} from "@/constants/auth";
import { googleErrorCode } from "@/features/auth/google-errors";
import { createSchoolSession } from "@/features/school-auth/session";
import { createTeacherSession } from "@/features/teacher-auth/session";
import { ApiError } from "@/services/api-client";
import { loginWithGoogle } from "@/services/auth";

export function isGoogleAuthConfigured() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

async function clearGoogleHandshakeCookies() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: GOOGLE_PORTAL_COOKIE, path: "/" });
  cookieStore.delete({ name: RETURN_TO_COOKIE, path: "/" });
  try {
    await signOut({ redirect: false });
  } catch {
    cookieStore.delete({ name: "authjs.session-token", path: "/" });
    cookieStore.delete({ name: "__Secure-authjs.session-token", path: "/" });
    cookieStore.delete({ name: "authjs.callback-url", path: "/" });
    cookieStore.delete({ name: "authjs.csrf-token", path: "/" });
  }
}

export async function completeGoogleSignIn(): Promise<never> {
  const cookieStore = await cookies();
  const portal = cookieStore.get(GOOGLE_PORTAL_COOKIE)?.value;

  if (portal !== "school") {
    await clearGoogleHandshakeCookies();
    redirect(`${SCHOOL_LOGIN_PATH}?error=google`);
  }

  const session = await auth();
  if (!session?.idToken) {
    await clearGoogleHandshakeCookies();
    redirect(`${SCHOOL_LOGIN_PATH}?error=google`);
  }

  try {
    const result = await loginWithGoogle(session.idToken, portal);

    if (result.role === "school") {
      await createSchoolSession(result.token, result.expiresAt);
    } else {
      await createTeacherSession(result.token, result.expiresAt);
    }

    const returnTo = cookieStore.get(RETURN_TO_COOKIE)?.value;
    await clearGoogleHandshakeCookies();

    if (result.role === "teacher") {
      redirect(safePortalReturnPath(returnTo, "teacher", TEACHER_HOME_PATH));
    }
    redirect(safePortalReturnPath(returnTo, "school", SCHOOL_HOME_PATH));
  } catch (error) {
    unstable_rethrow(error);
    await clearGoogleHandshakeCookies();
    const code =
      error instanceof ApiError
        ? googleErrorCode(error.message, error.status)
        : "google";
    redirect(`${SCHOOL_LOGIN_PATH}?error=${code}`);
  }
}
