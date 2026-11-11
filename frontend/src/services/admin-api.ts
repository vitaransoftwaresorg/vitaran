import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_LOGIN_PATH, ADMIN_SESSION_COOKIE } from "@/constants/auth";
import { ApiError, apiClient, buildApiUrl } from "@/services/api-client";

type AdminApiOptions = Parameters<typeof apiClient>[1];

async function authHeaders(init?: HeadersInit) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) redirect(ADMIN_LOGIN_PATH);

  const headers = new Headers(init);
  headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

export async function adminApi<T>(
  path: string,
  options: AdminApiOptions = {},
): Promise<T> {
  const headers = await authHeaders(options.headers);

  try {
    return await apiClient<T>(path, { ...options, headers, cache: "no-store" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(ADMIN_LOGIN_PATH);
    }
    throw error;
  }
}

/** Raw response for non-JSON endpoints such as file downloads. */
export async function adminFetch(path: string): Promise<Response> {
  return fetch(buildApiUrl(path), { headers: await authHeaders(), cache: "no-store" });
}
