import "server-only";
import { ApiError } from "@/services/api-client";
import { adminApi, adminFetch } from "@/services/admin-api";
import type {
  AdminDashboard,
  School,
  SchoolBoard,
  SchoolDetail,
  SchoolInput,
  SchoolList,
  SchoolOption,
  SchoolStats,
  SchoolStatus,
  SchoolType,
} from "@/types/school";

export type SchoolListParams = {
  search?: string;
  status?: SchoolStatus;
  board?: SchoolBoard;
  type?: SchoolType;
  page?: number;
  pageSize?: number;
};

export function listSchools(params: SchoolListParams = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }

  const suffix = query.size > 0 ? `?${query}` : "";
  return adminApi<SchoolList>(`/schools${suffix}`);
}

export function listSchoolOptions(params: { type?: SchoolType; status?: SchoolStatus } = {}) {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.status) query.set("status", params.status);
  const suffix = query.size > 0 ? `?${query}` : "";
  return adminApi<SchoolOption[]>(`/schools/options${suffix}`);
}

/** Options for customized answer-key upload — enrolled class levels per program. */
export function listCustomizedSchoolOptions() {
  return listSchoolOptions({ type: "CUSTOMIZED" });
}

export function getAdminDashboard() {
  return adminApi<AdminDashboard>("/dashboard");
}

export function getSchoolStats() {
  return adminApi<SchoolStats>("/schools/stats");
}

export async function getSchool(id: string): Promise<SchoolDetail | null> {
  try {
    return await adminApi<SchoolDetail>(`/schools/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

export function getAccountAvailability(email: string, excludeId?: string) {
  const query = new URLSearchParams({ email });
  if (excludeId) query.set("excludeId", excludeId);
  return adminApi<{ emailTaken: boolean }>(`/schools/account-availability?${query}`);
}

export function getCodeAvailability(code: string, excludeId?: string) {
  const query = new URLSearchParams({ code });
  if (excludeId) query.set("excludeId", excludeId);
  return adminApi<{ codeTaken: boolean }>(`/schools/code-availability?${query}`);
}

export function createSchool(input: SchoolInput) {
  return adminApi<School>("/schools", { method: "POST", body: input });
}

export function updateSchool(id: string, input: SchoolInput) {
  return adminApi<School>(`/schools/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export function uploadSchoolLogo(id: string, file: File) {
  const body = new FormData();
  body.append("logo", file);
  return adminApi<SchoolDetail>(`/schools/${encodeURIComponent(id)}/logo`, {
    method: "PUT",
    body,
  });
}

export function deleteSchoolLogo(id: string) {
  return adminApi<SchoolDetail>(`/schools/${encodeURIComponent(id)}/logo`, {
    method: "DELETE",
  });
}

export function fetchSchoolLogo(id: string) {
  return adminFetch(`/schools/${encodeURIComponent(id)}/logo`);
}

export function deleteSchool(id: string) {
  return adminApi<void>(`/schools/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function sendSchoolCredentials(id: string) {
  return adminApi<{ ok: true; to: string }>(`/schools/${encodeURIComponent(id)}/send-credentials`, {
    method: "POST",
  });
}

export function resetSchoolPassword(id: string, password: string) {
  return adminApi<{ ok: true; to: string }>(`/schools/${encodeURIComponent(id)}/reset-password`, {
    method: "POST",
    body: { password },
  });
}
