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
  identity?: {
    rollNo?: string;
    testId?: string;
    examPattern?: string;
    schoolId?: string;
    /** Admin: school answer key to merge over platform (default none). */
    schoolKeyId?: string;
    studentName?: string;
    /** Walk-in section — defaults to A on the server when omitted. */
    sectionId?: string;
    /** Walk-in class/program from PDF majority. */
    classLevel?: number;
    programCode?: string;
    /** PDF page / flat scan — skip photo perspective warp. */
    flat?: boolean;
    /** Failed PDF thumb already auto-rotated at scan — skip re-upright on save. */
    upright?: boolean;
    corners?: string;
  },
) {
  const body = new FormData();
  body.append("file", file);
  // Walk-in with empty reg: always send rollNo (including "") so the API skips bubbles.
  // Omit rollNo entirely on normal scans so the reader uses the printed bubbles.
  if (identity?.studentName) body.append("rollNo", identity.rollNo ?? "");
  else if (identity?.rollNo != null && identity.rollNo !== "") body.append("rollNo", identity.rollNo);
  if (identity?.testId) body.append("testId", identity.testId);
  if (identity?.examPattern) body.append("examPattern", identity.examPattern);
  if (identity?.schoolId) body.append("schoolId", identity.schoolId);
  if (identity?.schoolKeyId) body.append("schoolKeyId", identity.schoolKeyId);
  if (identity?.studentName) body.append("studentName", identity.studentName);
  if (identity?.sectionId) body.append("sectionId", identity.sectionId);
  if (identity?.classLevel) body.append("classLevel", String(identity.classLevel));
  if (identity?.programCode) body.append("programCode", identity.programCode);
  if (identity?.flat) body.append("flat", "1");
  if (identity?.upright) body.append("upright", "1");
  /** JSON `[[x, y] ×4]` (TL, TR, BR, BL, 0–1) from the phone document scanner. */
  if (identity?.corners) body.append("corners", identity.corners);
  const route = client(portal);
  return route.api<ScanPreview>(route.preview, { method: "POST", body });
}

export function commitScan(portal: ScanPortal, previewId: string, options?: { rollNo?: string }) {
  const route = client(portal);
  const rollNo = options?.rollNo?.replace(/\D/g, "");
  return route.api<{ scan: OmScan }>(route.commit, {
    method: "POST",
    body: {
      previewId,
      ...(rollNo ? { rollNo } : {}),
    },
  });
}

type BindIdentity = {
  rollNo?: string;
  studentName?: string;
  schoolId?: string;
  sectionId?: string;
  classLevel?: number;
  programCode?: string;
};

/** Bind reg/name onto a pending already scored at scan — no bubble re-read. */
export function bindPendingIdentity(portal: ScanPortal, previewId: string, identity: BindIdentity) {
  const route = client(portal);
  return route.api<ScanPreview>(`${route.list}/previews/${previewId}/bind`, {
    method: "POST",
    body: identity,
  });
}

/** Bind reg/name onto a failed PDF page that was scored at scan time. */
export function recoverPdfPage(
  portal: ScanPortal,
  batchId: string,
  page: number,
  identity: BindIdentity,
) {
  const route = client(portal);
  return route.api<ScanPreview>(`${route.list}/batches/${batchId}/pages/${page}/recover`, {
    method: "POST",
    body: identity,
  });
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

/** Saved OMR detail (answers + key) for results / student viewers. */
export function getOmScan(portal: ScanPortal, id: string) {
  const route = client(portal);
  return route.api<OmScan>(`${route.list}/${encodeURIComponent(id)}`);
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
