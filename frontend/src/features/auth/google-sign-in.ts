"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
  await signIn("google", { redirectTo: GOOGLE_COMPLETE_PATH });
}
