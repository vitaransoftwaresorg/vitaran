"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/services/api-client";
import {
  checkTestId,
  commitScan,
  commitScans,
  previewScan,
  type CommitManyResult,
  type ScanPortal,
} from "@/services/scans";
import type { OmScan, ScanPreview, TestIdCheck } from "@/types/scan";

const PATHS: Record<ScanPortal, string> = {
  admin: "/admin/omr-scan",
  school: "/school/omr-scan",
  teacher: "/teacher/omr-scan",
};

function scanFile(formData: FormData): { ok: true; file: File } | { ok: false; error: string } {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Attach an OMR sheet image" };
  return { ok: true, file };
}

export async function previewScanAction(
  portal: ScanPortal,
  formData: FormData,
): Promise<{ ok: true; result: ScanPreview } | { ok: false; message: string }> {
  const parsed = scanFile(formData);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const rollNo = String(formData.get("rollNo") ?? "").trim();
  const testId = String(formData.get("testId") ?? "").trim();
  const corners = String(formData.get("corners") ?? "").trim();
  try {
    return { ok: true, result: await previewScan(portal, parsed.file, { rollNo, testId, corners }) };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Could not read the sheet. Try a clearer photo.";
    return { ok: false, message };
  }
}

export async function checkTestIdAction(
  portal: ScanPortal,
  testId: string,
): Promise<({ ok: true } & TestIdCheck) | { ok: false; message: string }> {
  try {
    return { ok: true, ...(await checkTestId(portal, testId.trim())) };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Could not check the test ID" };
  }
}

function revalidateResults(portal: ScanPortal) {
  revalidatePath(PATHS[portal]);
  revalidatePath("/admin/results");
  revalidatePath("/school/results");
  revalidatePath("/teacher/results");
}

/** One chunk of "Save all". */
export async function commitScansAction(
  portal: ScanPortal,
  previewIds: string[],
): Promise<{ ok: true; results: CommitManyResult[] } | { ok: false; message: string }> {
  try {
    const { results } = await commitScans(portal, previewIds);
    revalidateResults(portal);
    return { ok: true, results };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Could not save these sheets" };
  }
}

export async function commitScanAction(
  portal: ScanPortal,
  previewId: string,
): Promise<{ ok: true; scan: OmScan } | { ok: false; message: string }> {
  try {
    const result = await commitScan(portal, previewId);
    revalidateResults(portal);
    return { ok: true, scan: result.scan };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Could not save this scan" };
  }
}
