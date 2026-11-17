"use server";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import {
  GOOGLE_COMPLETE_PATH,
  GOOGLE_PORTAL_COOKIE,
  SCHOOL_LOGIN_PATH,
} from "@/constants/auth";
import { isGoogleAuthConfigured } from "./google-complete";

export async function continueWithGoogle() {
  if (!isGoogleAuthConfigured()) {
    redirect(`${SCHOOL_LOGIN_PATH}?error=Configuration`);
  }

  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_PORTAL_COOKIE, "school", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  try {
    await signIn("google", { redirectTo: GOOGLE_COMPLETE_PATH });
  } catch (error) {
    // Successful signIn throws a NEXT_REDIRECT — must not treat that as failure.
    unstable_rethrow(error);
    const type = error instanceof AuthError ? String(error.type) : "";
    const code =
      type === "AccessDenied" ? "AccessDenied" : type === "Configuration" ? "Configuration" : "OAuthSignin";
    redirect(`${SCHOOL_LOGIN_PATH}?error=${code}`);
  }
}
