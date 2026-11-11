"use server";

import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  SCHOOL_SESSION_COOKIE,
  TEACHER_SESSION_COOKIE,
} from "@/constants/auth";
import type { ScanPortal } from "@/services/scans";

/** Short-lived client upload credentials so large PDFs never enter the Next.js process. */
export async function getOmrUploadAuthAction(portal: ScanPortal): Promise<
  | { ok: true; token: string; uploadUrl: string; batchesUrl: string; previewsUrl: string }
  | { ok: false; message: string }
> {
  const jar = await cookies();
  const cookieName =
    portal === "school"
      ? SCHOOL_SESSION_COOKIE
      : portal === "teacher"
        ? TEACHER_SESSION_COOKIE
        : ADMIN_SESSION_COOKIE;
  const token = jar.get(cookieName)?.value?.trim();
  if (!token) return { ok: false, message: "Sign in again to upload." };

  const base =
    portal === "school"
      ? "/school/omr-scans"
      : portal === "teacher"
        ? "/teacher/omr-scans"
        : "/omr-scans";
  // Same-origin path rewritten to the API in next.config.ts.
  const api = "/omr-api";

  return {
    ok: true,
    token,
    uploadUrl: `${api}${base}/split-pdf`,
    batchesUrl: `${api}${base}/batches`,
    previewsUrl: `${api}${base}/previews`,
  };
}
