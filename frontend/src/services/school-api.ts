import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SCHOOL_LOGIN_PATH, SCHOOL_SESSION_COOKIE } from "@/constants/auth";
import { ApiError, apiClient, buildApiUrl } from "@/services/api-client";

type ApiInit = {
  method?: string;
  body?: unknown;
  cache?: RequestCache;
};

async function authHeaders() {
  const token = (await cookies()).get(SCHOOL_SESSION_COOKIE)?.value;
  if (!token) redirect(SCHOOL_LOGIN_PATH);
  return { Authorization: `Bearer ${token}` };
}

/** API calls on behalf of the signed-in school. */
export async function schoolApi<T>(path: string, init: ApiInit = {}): Promise<T> {
  try {
    return await apiClient<T>(path, {
      ...init,
      headers: await authHeaders(),
      cache: init.cache ?? "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(SCHOOL_LOGIN_PATH);
    throw error;
  }
}

/** Raw response for non-JSON endpoints such as file downloads. */
export async function schoolFetch(path: string): Promise<Response> {
  return fetch(buildApiUrl(path), { headers: await authHeaders(), cache: "no-store" });
}
