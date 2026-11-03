import "server-only";
import { ApiError } from "@/services/api-client";
import { adminApi } from "@/services/admin-api";
import { apiClient } from "@/services/api-client";
import type { LearningProgram, LearningProgramInput } from "@/types/program";

const ADMIN_BASE = "/programs";
const CATALOG_BASE = "/catalog/programs";

export function listPrograms() {
  return apiClient<LearningProgram[]>(CATALOG_BASE, { cache: "no-store" });
}

export function listAdminPrograms() {
  return adminApi<LearningProgram[]>(ADMIN_BASE);
}

export async function getProgram(id: string): Promise<LearningProgram | null> {
  try {
    return await adminApi<LearningProgram>(`${ADMIN_BASE}/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function createProgram(input: LearningProgramInput) {
  return adminApi<LearningProgram>(ADMIN_BASE, { method: "POST", body: input });
}

export function updateProgram(id: string, input: Partial<LearningProgramInput>) {
  return adminApi<LearningProgram>(`${ADMIN_BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteProgram(id: string) {
  return adminApi<void>(`${ADMIN_BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getProgramCodeAvailability(code: string, excludeId?: string) {
  const query = new URLSearchParams({ code });
  if (excludeId) query.set("excludeId", excludeId);
  return adminApi<{ taken: boolean }>(`${ADMIN_BASE}/code-availability?${query}`);
}
