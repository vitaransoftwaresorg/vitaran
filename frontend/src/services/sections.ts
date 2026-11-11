import "server-only";
import { adminApi } from "@/services/admin-api";
import { schoolApi } from "@/services/school-api";
import type {
  ClassOrganization,
  CreateClassOrgResult,
  SchoolSection,
  SectionInput,
  SectionStrength,
  WholeClass,
} from "@/types/section";

const SCHOOL_BASE = "/school/sections";

function adminBase(schoolId: string) {
  return `/schools/${encodeURIComponent(schoolId)}/sections`;
}

/** Sections only — used by teacher form for CT mode. */
export function listSchoolSections() {
  return schoolApi<SchoolSection[]>(SCHOOL_BASE);
}

export function listSchoolClassOrganization() {
  return schoolApi<ClassOrganization>(`${SCHOOL_BASE}/organization`);
}

export function getSchoolSectionStrength() {
  return schoolApi<SectionStrength>(`${SCHOOL_BASE}/strength`);
}

export function createSchoolSection(input: SectionInput) {
  return schoolApi<CreateClassOrgResult>(SCHOOL_BASE, { method: "POST", body: input });
}

export function updateSchoolSection(id: string, input: Partial<SectionInput>) {
  return schoolApi<SchoolSection>(`${SCHOOL_BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteSchoolSection(id: string) {
  return schoolApi<void>(`${SCHOOL_BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function updateSchoolWholeClass(
  id: string,
  input: { programId?: string; studentCount?: number },
) {
  return schoolApi<WholeClass>(`${SCHOOL_BASE}/classes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteSchoolWholeClass(id: string) {
  return schoolApi<void>(`${SCHOOL_BASE}/classes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listAdminSchoolSections(schoolId: string) {
  return adminApi<ClassOrganization>(adminBase(schoolId));
}

export function getAdminSchoolSectionStrength(schoolId: string) {
  return adminApi<SectionStrength>(`${adminBase(schoolId)}/strength`);
}
