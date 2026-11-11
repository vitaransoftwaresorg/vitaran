import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TEACHER_LOGIN_PATH, TEACHER_SESSION_COOKIE } from "@/constants/auth";
import { ApiError, apiClient, buildApiUrl } from "@/services/api-client";

type TeacherApiOptions = Parameters<typeof apiClient>[1];

async function authHeaders(init?: HeadersInit) {
  const token = (await cookies()).get(TEACHER_SESSION_COOKIE)?.value;
  if (!token) redirect(TEACHER_LOGIN_PATH);
  const headers = new Headers(init);
  headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

/** API calls on behalf of the signed-in teacher. */
export async function teacherApi<T>(path: string, options: TeacherApiOptions = {}): Promise<T> {
  const headers = await authHeaders(options.headers);
  try {
    return await apiClient<T>(path, { ...options, headers, cache: "no-store" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(TEACHER_LOGIN_PATH);
    throw error;
  }
}

export async function teacherFetch(path: string): Promise<Response> {
  return fetch(buildApiUrl(path), { headers: await authHeaders(), cache: "no-store" });
}
