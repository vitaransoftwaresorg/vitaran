import "server-only";
import { ApiError } from "@/services/api-client";
import { adminApi, adminFetch } from "@/services/admin-api";
import { schoolApi, schoolFetch } from "@/services/school-api";
import { teacherApi, teacherFetch } from "@/services/teacher-api";
import type { ClassScan, OmScan, ScanPreview, TestIdCheck } from "@/types/scan";

export type ScanPortal = "admin" | "school" | "teacher";

function client(portal: ScanPortal) {
  if (portal === "school")
    return {
      preview: "/school/omr-scans/preview",
      commit: "/school/omr-scans/commit",
      list: "/school/omr-scans",
      api: schoolApi,
      fetch: schoolFetch,
    };
  if (portal === "teacher")
    return {
      preview: "/teacher/omr-scans/preview",
      commit: "/teacher/omr-scans/commit",
      list: "/teacher/omr-scans",
      api: teacherApi,
      fetch: teacherFetch,
    };
  return {
    preview: "/omr-scans/preview",
    commit: "/omr-scans/commit",
    list: "/omr-scans",
    api: adminApi,
    fetch: adminFetch,
  };
}

export function previewScan(
  portal: ScanPortal,
  file: File,
  identity?: { rollNo?: string; testId?: string; corners?: string },
) {
  const body = new FormData();
  body.append("file", file);
  if (identity?.rollNo) body.append("rollNo", identity.rollNo);
  if (identity?.testId) body.append("testId", identity.testId);
  /** JSON `[[x, y] ×4]` (TL, TR, BR, BL, 0–1) from the phone document scanner. */
  if (identity?.corners) body.append("corners", identity.corners);
  const route = client(portal);
  return route.api<ScanPreview>(route.preview, { method: "POST", body });
}

export function commitScan(portal: ScanPortal, previewId: string) {
  const route = client(portal);
  return route.api<{ scan: OmScan }>(route.commit, { method: "POST", body: { previewId } });
}

export type CommitManyResult = { previewId: string; ok: true; scan: OmScan } | { previewId: string; ok: false; message: string };

/** Up to 25 sheets per call; the backend saves them in order and reports each. */
export function commitScans(portal: ScanPortal, previewIds: string[]) {
  const route = client(portal);
  return route.api<{ results: CommitManyResult[] }>(`${route.commit}-many`, { method: "POST", body: { previewIds } });
}

export function checkTestId(portal: ScanPortal, testId: string) {
  const route = client(portal);
  return route.api<TestIdCheck>(`${route.list}/check-test/${encodeURIComponent(testId)}`);
}

export function listScans(portal: ScanPortal) {
  const route = client(portal);
  return route.api<OmScan[]>(route.list);
}

export type ClassScanFilter = { schoolId: string; testNumber: number; classLevel: number; program?: string };

function classQuery(filter: ClassScanFilter, kind?: string) {
  const query = new URLSearchParams({
    schoolId: filter.schoolId,
    testNumber: String(filter.testNumber),
    classLevel: String(filter.classLevel),
  });
  if (filter.program) query.set("program", filter.program);
  if (kind) query.set("kind", kind);
  return query;
}

/** Saved OMRs of one class; empty when none or on error so the results table still loads. */
export async function listAdminClassScans(filter: ClassScanFilter): Promise<ClassScan[]> {
  return listClassScans("admin", filter);
}

export async function listClassScans(portal: ScanPortal, filter: ClassScanFilter): Promise<ClassScan[]> {
  const route = client(portal);
  try {
    return await route.api<ClassScan[]>(`${route.list}/class?${classQuery(filter)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw error;
    return [];
  }
}

export function fetchScanImage(portal: ScanPortal, id: string, kind: string) {
  const route = client(portal);
  return route.fetch(`${route.list}/${encodeURIComponent(id)}/image?kind=${encodeURIComponent(kind)}`);
}

export function fetchClassScansPdf(portal: ScanPortal, filter: ClassScanFilter, kind: string) {
  const route = client(portal);
  return route.fetch(`${route.list}/class/pdf?${classQuery(filter, kind)}`);
}

export const fetchAdminScanImage = (id: string, kind: string) => fetchScanImage("admin", id, kind);
export const fetchAdminClassScansPdf = (filter: ClassScanFilter, kind: string) =>
  fetchClassScansPdf("admin", filter, kind);

export async function listScansOrEmpty(portal: ScanPortal) {
  try {
    return await listScans(portal);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status === 401) throw error;
    return [];
  }
}
