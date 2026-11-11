import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ADMIN_BASE_PATH, ADMIN_LOGIN_PATH, ADMIN_SESSION_COOKIE } from "@/constants/auth";
import { createSession } from "@/lib/session";
import { fetchCurrentAdmin } from "@/services/auth";
import type { AdminProfile } from "@/types/auth";

const adminSession = createSession<AdminProfile>({
  cookieName: ADMIN_SESSION_COOKIE,
  path: ADMIN_BASE_PATH,
  fetchProfile: fetchCurrentAdmin,
});

export const createAdminSession = adminSession.create;
export const getAdminSession = adminSession.get;

export async function deleteAdminSession() {
  const cookieStore = await cookies();
  // cookies().set is keyed by name — expire the Path=/admin cookie that login issues.
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: ADMIN_BASE_PATH,
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * For admin-only pages. The proxy already redirects when there's no cookie;
 * this also catches expired or revoked tokens.
 */
export async function verifyAdminSession(): Promise<AdminProfile> {
  await connection();
  const admin = await getAdminSession();
  if (!admin) redirect(ADMIN_LOGIN_PATH);
  return admin;
}
