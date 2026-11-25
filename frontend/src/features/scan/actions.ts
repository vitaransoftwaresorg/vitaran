"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/services/api-client";
import {
  bindPendingIdentity,
  checkTestId,
  commitScan,
  commitScans,
  getOmScan,
  previewScan,
  recoverPdfPage,
  type CommitManyResult,
  type ScanPortal,
} from "@/services/scans";
import type { OmScan, ScanPreview, TestIdCheck } from "@/types/scan";
import type { OmrStudentMatch } from "./omr-student-actions";
import { ambiguousMatchesFromDetails } from "./roll-helpers";

export type PreviewScanFailure = {
  ok: false;
  message: string;
  matches?: OmrStudentMatch[];
  rollNo?: string;
  /** Answers already scored — bind reg/name without re-reading bubbles. */
  previewId?: string;
};

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
): Promise<{ ok: true; result: ScanPreview } | PreviewScanFailure> {
  const parsed = scanFile(formData);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const rollNo = String(formData.get("rollNo") ?? "").trim();
  const testId = String(formData.get("testId") ?? "").trim();
  const examPattern = String(formData.get("examPattern") ?? "").trim();
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const studentName = String(formData.get("studentName") ?? "").trim();
  const flat = String(formData.get("flat") ?? "").trim();
  const upright = String(formData.get("upright") ?? "").trim();
  const sectionId = String(formData.get("sectionId") ?? "").trim();
  const classRaw = String(formData.get("classLevel") ?? "").trim();
  const programCode = String(formData.get("programCode") ?? "").trim();
  const classLevel = /^\d{1,2}$/.test(classRaw) ? Number(classRaw) : undefined;
  const corners = String(formData.get("corners") ?? "").trim();
  // Walk-in with empty reg → send "" so the reader does not require bubbles.
  const digits = rollNo.replace(/\D/g, "");
  const walkInRoll =
    studentName && (digits.length === 0 || /^0+$/.test(digits)) ? "" : rollNo;
  try {
    return {
      ok: true,
      result: await previewScan(portal, parsed.file, {
        rollNo: walkInRoll,
        testId,
        examPattern: examPattern || undefined,
        schoolId: schoolId || undefined,
        studentName: studentName || undefined,
        sectionId: sectionId || undefined,
        classLevel,
        programCode: programCode || undefined,
        flat: flat === "1" || flat === "true",
        upright: upright === "1" || upright === "true",
        corners,
      }),
    };
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Could not read the sheet. Try a clearer photo.";
    if (!(error instanceof ApiError)) return { ok: false, message };
    const details =
      error.details && typeof error.details === "object"
        ? (error.details as { rollNo?: unknown; previewId?: unknown; code?: unknown })
        : undefined;
    const matches = ambiguousMatchesFromDetails(error.details);
    const previewId =
      typeof details?.previewId === "string" ? details.previewId : undefined;
    if (!matches?.length && !previewId) return { ok: false, message };
    return {
      ok: false,
      message,
      previewId,
      rollNo: typeof details?.rollNo === "string" ? details.rollNo : rollNo || undefined,
      matches: matches?.map((row) => ({
        id: row.id ?? `${row.schoolId}:${row.rollNo}`,
        name: row.name,
        rollNo: row.rollNo,
        classLevel: row.classLevel,
        sectionName: row.sectionName ?? null,
        programName: row.programName ?? null,
        schoolId: row.schoolId,
        schoolName: row.schoolName,
      })),
    };
  }
}

export async function recoverPdfPageAction(
  portal: ScanPortal,
  batchId: string,
  page: number,
  identity: {
    rollNo?: string;
    studentName?: string;
    schoolId?: string;
    sectionId?: string;
    classLevel?: number;
    programCode?: string;
  },
): Promise<{ ok: true; result: ScanPreview } | PreviewScanFailure> {
  try {
    return { ok: true, result: await recoverPdfPage(portal, batchId, page, identity) };
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Could not save this page with that registration.";
    if (!(error instanceof ApiError)) return { ok: false, message };
    const matches = ambiguousMatchesFromDetails(error.details);
    return {
      ok: false,
      message,
      rollNo:
        typeof (error.details as { rollNo?: unknown })?.rollNo === "string"
          ? String((error.details as { rollNo: string }).rollNo)
          : identity.rollNo,
      matches: matches?.map((row) => ({
        id: row.id ?? `${row.schoolId}:${row.rollNo}`,
        name: row.name,
        rollNo: row.rollNo,
        classLevel: row.classLevel,
        sectionName: row.sectionName ?? null,
        programName: row.programName ?? null,
        schoolId: row.schoolId,
        schoolName: row.schoolName,
      })),
    };
  }
}

export async function bindPendingIdentityAction(
  portal: ScanPortal,
  previewId: string,
  identity: {
    rollNo?: string;
    studentName?: string;
    schoolId?: string;
    sectionId?: string;
    classLevel?: number;
    programCode?: string;
  },
): Promise<{ ok: true; result: ScanPreview } | PreviewScanFailure> {
  try {
    return { ok: true, result: await bindPendingIdentity(portal, previewId, identity) };
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Could not save with that registration.";
    if (!(error instanceof ApiError)) return { ok: false, message };
    const matches = ambiguousMatchesFromDetails(error.details);
    return {
      ok: false,
      message,
      previewId,
      rollNo:
        typeof (error.details as { rollNo?: unknown })?.rollNo === "string"
          ? String((error.details as { rollNo: string }).rollNo)
          : identity.rollNo,
      matches: matches?.map((row) => ({
        id: row.id ?? `${row.schoolId}:${row.rollNo}`,
        name: row.name,
        rollNo: row.rollNo,
        classLevel: row.classLevel,
        sectionName: row.sectionName ?? null,
        programName: row.programName ?? null,
        schoolId: row.schoolId,
        schoolName: row.schoolName,
      })),
    };
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
  options?: { rollNo?: string },
): Promise<{ ok: true; scan: OmScan } | { ok: false; message: string }> {
  try {
    const result = await commitScan(portal, previewId, options);
    revalidateResults(portal);
    return { ok: true, scan: result.scan };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Could not save this scan" };
  }
}

/** Results / student profile OMR dialog — load answers + key (not used on review). */
export async function getOmScanAction(
  portal: ScanPortal,
  id: string,
): Promise<{ ok: true; scan: OmScan } | { ok: false; message: string }> {
  try {
    return { ok: true, scan: await getOmScan(portal, id) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : "Could not load this OMR",
    };
  }
}
