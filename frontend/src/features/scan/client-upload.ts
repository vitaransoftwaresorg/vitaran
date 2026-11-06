"use client";

import { isApiErrorResponse, isApiSuccessResponse } from "@/types/api";
import type { ScanPreview } from "@/types/scan";

async function readApiJson<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = isApiErrorResponse(payload)
      ? payload.error.message
      : response.statusText || "Upload failed";
    throw new Error(message);
  }
  if (!isApiSuccessResponse<T>(payload)) {
    throw new Error("Unexpected API response");
  }
  return payload.data;
}

/** Upload a PDF straight to Express — keeps large files out of Next.js memory. */
export async function registerOmrPdfDirect(
  uploadUrl: string,
  token: string,
  file: File,
  testId: string,
): Promise<{ batchId: string; pageCount: number; testId: string }> {
  const body = new FormData();
  // Text field before file so multer always sees it; also pass as query (reliable).
  body.append("testId", testId);
  body.append("file", file);
  const url = new URL(uploadUrl);
  url.searchParams.set("testId", testId);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "X-Test-Id": testId,
    },
    body,
  });
  return readApiJson(response);
}

export async function previewOmrPdfPageDirect(
  batchPreviewUrl: string,
  token: string,
  batchId: string,
  page: number,
  identity?: { rollNo?: string; testId?: string },
): Promise<ScanPreview> {
  const response = await fetch(batchPreviewUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      batchId,
      page,
      ...(identity?.rollNo ? { rollNo: identity.rollNo } : {}),
      ...(identity?.testId ? { testId: identity.testId } : {}),
    }),
  });
  return readApiJson(response);
}
