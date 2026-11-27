import "server-only";
import { redirect } from "next/navigation";
import { HEAD_OFFICE_SESSION_COOKIE, PORTAL_SESSION_EXPIRED_PATH } from "@/constants/auth";
import { createSession } from "@/lib/session";
import { fetchCurrentHeadOffice } from "@/services/auth";
import type { HeadOfficeAccount } from "@/types/head-office-portal";

const headOfficeSession = createSession<HeadOfficeAccount>({
  cookieName: HEAD_OFFICE_SESSION_COOKIE,
  path: "/",
  fetchProfile: fetchCurrentHeadOffice,
});

export const createHeadOfficeSession = headOfficeSession.create;
export const deleteHeadOfficeSession = headOfficeSession.remove;
export const getHeadOfficeSession = headOfficeSession.get;

export async function verifyHeadOfficeSession(): Promise<HeadOfficeAccount> {
  const office = await getHeadOfficeSession();
  if (!office) redirect(PORTAL_SESSION_EXPIRED_PATH);
  return office;
}
