import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, PORTAL_SESSION_EXPIRED_PATH } from "@/constants/auth";
import { createSession } from "@/lib/session";
import { fetchCurrentAdmin } from "@/services/auth";
import type { AdminProfile } from "@/types/auth";

const adminSession = createSession<AdminProfile>({
  cookieName: ADMIN_SESSION_COOKIE,
  // Site-wide so signed-in admins are redirected off the marketing landing (same as school/teacher).
  path: "/",
  fetchProfile: fetchCurrentAdmin,
});

export const createAdminSession = adminSession.create;
export const getAdminSession = adminSession.get;

export async function deleteAdminSession() {
  // Prefer /admin/logout — it clears both Path=/ and legacy Path=/admin via Set-Cookie.
  await adminSession.remove();
}

/**
 * For admin-only pages. The proxy already redirects when there's no cookie;
 * this also catches expired or revoked tokens.
 * Must clear cookies via session-expired — redirecting straight to login loops
 * (proxy still sees the cookie and sends the user back to /admin).
 */
export async function verifyAdminSession(): Promise<AdminProfile> {
  await connection();
  const admin = await getAdminSession();
  if (!admin) redirect(PORTAL_SESSION_EXPIRED_PATH);
  return admin;
}
