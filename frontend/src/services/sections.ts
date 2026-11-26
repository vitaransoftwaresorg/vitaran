import "server-only";
import { adminApi } from "@/services/admin-api";
import { schoolApi } from "@/services/school-api";
import { teacherApi } from "@/services/teacher-api";
import type {
  ClassOrganization,
  CreateClassOrgResult,
  SchoolSection,
  SectionInput,
  SectionStrength,
  WholeClass,
} from "@/types/section";

const SCHOOL_BASE = "/school/sections";
const TEACHER_BASE = "/teacher/sections";

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

export function listTeacherClassOrganization() {
  return teacherApi<ClassOrganization>(`${TEACHER_BASE}/organization`);
}

export function getSchoolSectionStrength() {
  return schoolApi<SectionStrength>(`${SCHOOL_BASE}/strength`);
}

export function listAdminSchoolSections(schoolId: string) {
  return adminApi<ClassOrganization>(adminBase(schoolId));
}

export function getAdminSchoolSectionStrength(schoolId: string) {
  return adminApi<SectionStrength>(`${adminBase(schoolId)}/strength`);
}

export function createAdminSchoolSection(schoolId: string, input: SectionInput) {
  return adminApi<CreateClassOrgResult>(adminBase(schoolId), { method: "POST", body: input });
}

export function updateAdminSchoolSection(
  schoolId: string,
  id: string,
  input: Partial<SectionInput>,
) {
  return adminApi<SchoolSection>(`${adminBase(schoolId)}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteAdminSchoolSection(schoolId: string, id: string) {
  return adminApi<void>(`${adminBase(schoolId)}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function updateAdminSchoolWholeClass(
  schoolId: string,
  id: string,
  input: { programId?: string; studentCount?: number; examPattern?: string },
) {
  return adminApi<WholeClass>(`${adminBase(schoolId)}/classes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}
