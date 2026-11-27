import "server-only";
import { headOfficeApi } from "@/services/head-office-api";
import type { SchoolLoginResult } from "@/types/auth";
import type {
  HeadOfficeDashboard,
  HeadOfficeSchoolDetail,
} from "@/types/head-office-portal";
import type { SchoolSummary } from "@/types/school";

const BASE = "/head-office";

export function getHeadOfficeDashboard() {
  return headOfficeApi<HeadOfficeDashboard>(`${BASE}/dashboard`);
}

export function listHeadOfficeSchools() {
  return headOfficeApi<SchoolSummary[]>(`${BASE}/schools`);
}

export function getHeadOfficeSchool(id: string) {
  return headOfficeApi<HeadOfficeSchoolDetail>(`${BASE}/schools/${encodeURIComponent(id)}`);
}

/** Open a linked school portal session under the head office account. */
export function assumeHeadOfficeSchool(id: string) {
  return headOfficeApi<SchoolLoginResult>(`${BASE}/schools/${encodeURIComponent(id)}/session`, {
    method: "POST",
  });
}

export function sendHeadOfficeSchoolCredentials(id: string) {
  return headOfficeApi<{ ok: true; to: string }>(
    `${BASE}/schools/${encodeURIComponent(id)}/send-credentials`,
    { method: "POST" },
  );
}

export function resetHeadOfficeSchoolPassword(id: string, password: string) {
  return headOfficeApi<{ ok: true; to: string }>(
    `${BASE}/schools/${encodeURIComponent(id)}/reset-password`,
    { method: "POST", body: { password } },
  );
}

export function updateHeadOfficeSchoolLoginEmail(id: string, accountEmail: string) {
  return headOfficeApi<{ ok: true; accountEmail: string }>(
    `${BASE}/schools/${encodeURIComponent(id)}/login-email`,
    { method: "PATCH", body: { accountEmail } },
  );
}
