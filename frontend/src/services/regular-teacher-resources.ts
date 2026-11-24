import "server-only";
import { adminApi, adminFetch } from "@/services/admin-api";
import { apiClient } from "@/services/api-client";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  SCHOOL_SESSION_COOKIE,
  TEACHER_SESSION_COOKIE,
} from "@/constants/auth";
import { buildApiUrl } from "@/services/api-client";

export type RegularTeacherResource = {
  id: string;
  programCode: string;
  classLevel: number;
  subject: string;
  volume: number | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
};

export function listAdminRegularTeacherResources(programCode?: string) {
  const query = programCode ? `?programCode=${encodeURIComponent(programCode)}` : "";
  return adminApi<RegularTeacherResource[]>(`/admin/teacher-resources${query}`);
}

export function uploadAdminRegularTeacherResource(
  programCode: string,
  classLevel: number,
  subject: string,
  file: File,
  volume = 0,
) {
  const body = new FormData();
  body.append("file", file);
  body.append("programCode", programCode);
  body.append("classLevel", String(classLevel));
  body.append("subject", subject);
  body.append("volume", String(volume));
  return adminApi<RegularTeacherResource>("/admin/teacher-resources", {
    method: "PUT",
    body,
  });
}

export function deleteAdminRegularTeacherResource(
  programCode: string,
  classLevel: number,
  subject: string,
  volume = 0,
) {
  const query = volume > 0 ? `?volume=${volume}` : "";
  return adminApi<void>(
    `/admin/teacher-resources/${encodeURIComponent(programCode)}/${classLevel}/${encodeURIComponent(subject)}${query}`,
    { method: "DELETE" },
  );
}

export function fetchAdminRegularTeacherResource(
  programCode: string,
  classLevel: number,
  subject: string,
  volume = 0,
) {
  const query = volume > 0 ? `?volume=${volume}` : "";
  return adminFetch(
    `/admin/teacher-resources/${encodeURIComponent(programCode)}/${classLevel}/${encodeURIComponent(subject)}${query}`,
  );
}

async function portalBearer(): Promise<string | null> {
  const jar = await cookies();
  return (
    jar.get(ADMIN_SESSION_COOKIE)?.value ??
    jar.get(SCHOOL_SESSION_COOKIE)?.value ??
    jar.get(TEACHER_SESSION_COOKIE)?.value ??
    null
  );
}

export async function listPublicRegularTeacherResources(programCode?: string) {
  const query = programCode ? `?programCode=${encodeURIComponent(programCode)}` : "";
  const token = await portalBearer();
  return apiClient<RegularTeacherResource[]>(`/public/teacher-resources${query}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

/** Absolute backend URL for streaming a PDF (used by Next API proxy). */
export async function publicTeacherResourceFileUrl(
  programCode: string,
  classLevel: number,
  subject: string,
  volume = 0,
) {
  const query = volume > 0 ? `?volume=${volume}` : "";
  return buildApiUrl(
    `/public/teacher-resources/${encodeURIComponent(programCode)}/${classLevel}/${encodeURIComponent(subject)}${query}`,
  );
}

export async function fetchPublicRegularTeacherResource(
  programCode: string,
  classLevel: number,
  subject: string,
  volume = 0,
) {
  const url = await publicTeacherResourceFileUrl(programCode, classLevel, subject, volume);
  const token = await portalBearer();
  return fetch(url, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
