import "server-only";
import { ApiError } from "@/services/api-client";
import { adminApi } from "@/services/admin-api";
import type { HeadOffice, HeadOfficeInput, HeadOfficeListItem } from "@/types/head-office";

const BASE = "/head-offices";

export function listHeadOffices() {
  return adminApi<HeadOfficeListItem[]>(BASE);
}

export async function getHeadOffice(id: string): Promise<HeadOffice | null> {
  try {
    return await adminApi<HeadOffice>(`${BASE}/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function createHeadOffice(input: HeadOfficeInput) {
  return adminApi<HeadOffice>(BASE, { method: "POST", body: input });
}

export function updateHeadOffice(id: string, input: HeadOfficeInput) {
  return adminApi<HeadOffice>(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteHeadOffice(id: string) {
  return adminApi<void>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getHeadOfficeCodeAvailability(code: string, excludeId?: string) {
  const query = new URLSearchParams({ code });
  if (excludeId) query.set("excludeId", excludeId);
  return adminApi<{ taken: boolean }>(`${BASE}/code-availability?${query}`);
}

export function getHeadOfficeEmailAvailability(email: string, excludeId?: string) {
  const query = new URLSearchParams({ email });
  if (excludeId) query.set("excludeId", excludeId);
  return adminApi<{ taken: boolean; message: string | null }>(
    `${BASE}/email-availability?${query}`,
  );
}

export async function getNextHeadOfficeCode() {
  const result = await adminApi<{ code: string }>(`${BASE}/next-code`);
  return result.code;
}
