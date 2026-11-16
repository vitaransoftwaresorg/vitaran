import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_BASE_PATH,
  ADMIN_SESSION_COOKIE,
  SCHOOL_HOME_PATH,
  TEACHER_HOME_PATH,
  SCHOOL_SESSION_COOKIE,
  TEACHER_SESSION_COOKIE,
} from "@/constants/auth";

/**
 * Legacy / OAuth sign-in URL — always send people to the marketing home login dropdown.
 * Auth.js and session guards still point here so existing redirects keep working.
 */
export default async function PortalLoginPage({
  searchParams,
}: PageProps<"/school/login">) {
  const cookieStore = await cookies();
  if (cookieStore.has(ADMIN_SESSION_COOKIE)) redirect(ADMIN_BASE_PATH);
  if (cookieStore.has(SCHOOL_SESSION_COOKIE)) redirect(SCHOOL_HOME_PATH);
  if (cookieStore.has(TEACHER_SESSION_COOKIE)) redirect(TEACHER_HOME_PATH);

  const { error } = await searchParams;
  const params = new URLSearchParams({ login: "1" });
  if (typeof error === "string" && error) params.set("error", error);
  redirect(`/?${params.toString()}`);
}
