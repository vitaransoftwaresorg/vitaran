import "server-only";
import { ApiError } from "@/services/api-client";
import { adminApi } from "@/services/admin-api";
import { schoolApi } from "@/services/school-api";
import { teacherApi } from "@/services/teacher-api";
import type { OmScan, ScanPreview } from "@/types/scan";

export type ScanPortal = "admin" | "school" | "teacher";

function client(portal: ScanPortal) {
  if (portal === "school") return { preview: "/school/omr-scans/preview", commit: "/school/omr-scans/commit", list: "/school/omr-scans", api: schoolApi };
  if (portal === "teacher") return { preview: "/teacher/omr-scans/preview", commit: "/teacher/omr-scans/commit", list: "/teacher/omr-scans", api: teacherApi };
  return { preview: "/omr-scans/preview", commit: "/omr-scans/commit", list: "/omr-scans", api: adminApi };
}

export function previewScan(
  portal: ScanPortal,
  file: File,
  identity?: { rollNo?: string; testId?: string },
) {
  const body = new FormData();
  body.append("file", file);
  if (identity?.rollNo) body.append("rollNo", identity.rollNo);
  if (identity?.testId) body.append("testId", identity.testId);
  const route = client(portal);
  return route.api<ScanPreview>(route.preview, { method: "POST", body });
}

export function commitScan(portal: ScanPortal, previewId: string) {
  const route = client(portal);
  return route.api<{ scan: OmScan }>(route.commit, { method: "POST", body: { previewId } });
}

export function listScans(portal: ScanPortal) {
  const route = client(portal);
  return route.api<OmScan[]>(route.list);
}

export async function listScansOrEmpty(portal: ScanPortal) {
  try {
    return await listScans(portal);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status === 401) throw error;
    return [];
  }
}
