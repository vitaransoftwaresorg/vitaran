"use client";

import { isApiErrorResponse, isApiSuccessResponse } from "@/types/api";
import type { PdfBatchStatus, PdfBatchSummary } from "@/types/scan";

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

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: "application/json" });

/** Upload a PDF straight to Express — keeps large files out of Next.js memory. Reading starts on the server. */
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
  const url = new URL(uploadUrl, window.location.origin);
  url.searchParams.set("testId", testId);
  const response = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders(token), "X-Test-Id": testId },
    body,
  });
  return readApiJson(response);
}

/** Progress plus sheets finished from index `from` on. */
export async function fetchPdfBatchDirect(batchesUrl: string, token: string, batchId: string, from: number) {
  const url = new URL(`${batchesUrl}/${batchId}`, window.location.origin);
  url.searchParams.set("from", String(from));
  return readApiJson<PdfBatchStatus>(await fetch(url, { headers: authHeaders(token), cache: "no-store" }));
}

export async function fetchActivePdfBatchDirect(batchesUrl: string, token: string) {
  return readApiJson<PdfBatchSummary | null>(
    await fetch(`${batchesUrl}/active`, { headers: authHeaders(token), cache: "no-store" }),
  );
}

/** A PDF page that could not be read, as an object URL. */
export async function fetchPdfPageImageDirect(batchesUrl: string, token: string, batchId: string, page: number) {
  const response = await fetch(`${batchesUrl}/${batchId}/pages/${page}/image`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) await readApiJson(response);
  return URL.createObjectURL(await response.blob());
}

/** The original uploaded photo / PDF page of a sheet that is not saved yet, as an object URL. */
export async function fetchOriginalSheetDirect(previewsUrl: string, token: string, previewId: string) {
  const response = await fetch(`${previewsUrl}/${previewId}/image?kind=raw`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) await readApiJson(response);
  return URL.createObjectURL(await response.blob());
}

export async function dismissPdfBatchDirect(batchesUrl: string, token: string, batchId: string) {
  return readApiJson<{ batchId: string }>(
    await fetch(`${batchesUrl}/${batchId}`, { method: "DELETE", headers: authHeaders(token) }),
  );
}
