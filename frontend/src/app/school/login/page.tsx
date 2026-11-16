import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SCHOOL_HOME_PATH,
  SCHOOL_SESSION_COOKIE,
  TEACHER_HOME_PATH,
  TEACHER_SESSION_COOKIE,
} from "@/constants/auth";
import { googleErrorMessage } from "@/features/auth/google-errors";
import { PortalLoginForm } from "@/features/auth/portal-login-form";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = {
  title: "Portal Sign In",
};

/** Fallback route for OAuth / session redirects — form only, no marketing copy. */
export default async function PortalLoginPage({
  searchParams,
}: PageProps<"/school/login">) {
  const cookieStore = await cookies();
  if (cookieStore.has(SCHOOL_SESSION_COOKIE)) redirect(SCHOOL_HOME_PATH);
  if (cookieStore.has(TEACHER_SESSION_COOKIE)) redirect(TEACHER_HOME_PATH);
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#f5f3ff] px-5 py-10">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm">
        <PortalLoginForm compact googleError={googleErrorMessage(error)} />
      </div>
    </main>
  );
}
