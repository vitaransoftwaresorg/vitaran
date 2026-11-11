import "server-only";
import { redirect } from "next/navigation";
import { PORTAL_SESSION_EXPIRED_PATH, SCHOOL_SESSION_COOKIE } from "@/constants/auth";
import { createSession } from "@/lib/session";
import { fetchCurrentSchool } from "@/services/auth";
import type { SchoolAccount } from "@/types/school";

const schoolSession = createSession<SchoolAccount>({
  cookieName: SCHOOL_SESSION_COOKIE,
  path: "/",
  fetchProfile: fetchCurrentSchool,
});

export const createSchoolSession = schoolSession.create;
export const deleteSchoolSession = schoolSession.remove;
export const getSchoolSession = schoolSession.get;

/**
 * For school-only pages. The proxy already redirects when there's no cookie;
 * this also catches expired or revoked tokens.
 */
export async function verifySchoolSession(): Promise<SchoolAccount> {
  const school = await getSchoolSession();
  if (!school) redirect(PORTAL_SESSION_EXPIRED_PATH);
  return school;
}
