import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HEAD_OFFICE_SESSION_COOKIE, PORTAL_SESSION_EXPIRED_PATH } from "@/constants/auth";
import { ApiError, apiClient } from "@/services/api-client";

type ApiInit = {
  method?: string;
  body?: unknown;
  cache?: RequestCache;
};

async function authHeaders() {
  const token = (await cookies()).get(HEAD_OFFICE_SESSION_COOKIE)?.value;
  if (!token) redirect(PORTAL_SESSION_EXPIRED_PATH);
  return { Authorization: `Bearer ${token}` };
}

/** API calls on behalf of the signed-in head office. */
export async function headOfficeApi<T>(path: string, init: ApiInit = {}): Promise<T> {
  try {
    return await apiClient<T>(path, {
      ...init,
      headers: await authHeaders(),
      cache: init.cache ?? "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(PORTAL_SESSION_EXPIRED_PATH);
    throw error;
  }
}
