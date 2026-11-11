import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { ApiError } from "@/services/api-client";

type SessionConfig<T> = {
  cookieName: string;
  /** Cookie scope: admin sessions stay under `/admin`, school sessions are site-wide. */
  path: string;
  fetchProfile: (token: string) => Promise<T>;
};

/** httpOnly cookie that holds an API token, plus a cached per-request lookup of its owner. */
export function createSession<T>({ cookieName, path, fetchProfile }: SessionConfig<T>) {
  async function create(token: string, expiresAt: string) {
    (await cookies()).set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path,
      expires: new Date(expiresAt),
    });
  }

  async function remove() {
    (await cookies()).delete({ name: cookieName, path });
  }

  const get = cache(async (): Promise<T | null> => {
    const token = (await cookies()).get(cookieName)?.value;
    if (!token) return null;

    try {
      return await fetchProfile(token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  });

  return { create, remove, get };
}
