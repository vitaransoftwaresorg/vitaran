import "server-only";
import { ApiError } from "@/services/api-client";
import { adminApi } from "@/services/admin-api";
import { schoolApi } from "@/services/school-api";
import { teacherApi } from "@/services/teacher-api";
import type { SchoolSection } from "@/types/section";
import type {
  ClassTeacherSlot,
  SchoolDashboardStats,
  Teacher,
  TeacherDashboardStats,
  TeacherDetail,
  TeacherInput,
  TeacherList,
} from "@/types/teacher";

const ADMIN_BASE = "/teachers";
const SCHOOL_BASE = "/school/teachers";

type ListParams = {
  schoolId?: string;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

function queryString(params: ListParams = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listAdminTeachers(params?: ListParams) {
  return adminApi<TeacherList>(`${ADMIN_BASE}${queryString(params)}`);
}

export async function getAdminTeacher(id: string): Promise<TeacherDetail | null> {
  try {
    return await adminApi<TeacherDetail>(`${ADMIN_BASE}/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function createAdminTeacher(schoolId: string, input: TeacherInput) {
  return adminApi<TeacherDetail>(`${ADMIN_BASE}/for-school/${encodeURIComponent(schoolId)}`, {
    method: "POST",
    body: input,
  });
}

export function updateAdminTeacher(id: string, input: Partial<TeacherInput>) {
  return adminApi<TeacherDetail>(`${ADMIN_BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export function setAdminTeacherStatus(id: string, status: "ACTIVE" | "INACTIVE") {
  return adminApi<Teacher>(`${ADMIN_BASE}/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export function deleteAdminTeacher(id: string) {
  return adminApi<void>(`${ADMIN_BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function sendAdminTeacherCredentials(id: string) {
  return adminApi<{ ok: true; to: string }>(
    `${ADMIN_BASE}/${encodeURIComponent(id)}/send-credentials`,
    { method: "POST" },
  );
}

export function resetAdminTeacherPassword(id: string, password: string) {
  return adminApi<{ ok: true; to: string }>(
    `${ADMIN_BASE}/${encodeURIComponent(id)}/reset-password`,
    { method: "POST", body: { password } },
  );
}

export function getSchoolDashboard() {
  return schoolApi<SchoolDashboardStats>(`${SCHOOL_BASE}/dashboard`);
}

export function getTeacherDashboard() {
  return teacherApi<TeacherDashboardStats>("/teacher/students/dashboard");
}

export function listSchoolTeachers(params?: Omit<ListParams, "schoolId">) {
  return schoolApi<TeacherList>(`${SCHOOL_BASE}${queryString(params)}`);
}

export async function getSchoolTeacher(id: string): Promise<TeacherDetail | null> {
  try {
    return await schoolApi<TeacherDetail>(`${SCHOOL_BASE}/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function createSchoolTeacher(input: TeacherInput) {
  return schoolApi<TeacherDetail>(SCHOOL_BASE, { method: "POST", body: input });
}

export function updateSchoolTeacher(id: string, input: Partial<TeacherInput>) {
  return schoolApi<TeacherDetail>(`${SCHOOL_BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export function setSchoolTeacherStatus(id: string, status: "ACTIVE" | "INACTIVE") {
  return schoolApi<Teacher>(`${SCHOOL_BASE}/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export function deleteSchoolTeacher(id: string) {
  return schoolApi<void>(`${SCHOOL_BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function sendSchoolTeacherCredentials(id: string) {
  return schoolApi<{ ok: true; to: string }>(
    `${SCHOOL_BASE}/${encodeURIComponent(id)}/send-credentials`,
    { method: "POST" },
  );
}

export function resetSchoolTeacherPassword(id: string, password: string) {
  return schoolApi<{ ok: true; to: string }>(
    `${SCHOOL_BASE}/${encodeURIComponent(id)}/reset-password`,
    { method: "POST", body: { password } },
  );
}

export function listSchoolClasses() {
  return schoolApi<SchoolSection[]>(`${SCHOOL_BASE}/classes`);
}

export function listSchoolClassTeacherSlots() {
  return schoolApi<ClassTeacherSlot[]>(`${SCHOOL_BASE}/class-teacher-slots`);
}

export function listAdminClassTeacherSlots(schoolId: string) {
  return adminApi<ClassTeacherSlot[]>(
    `${ADMIN_BASE}/class-teacher-slots?schoolId=${encodeURIComponent(schoolId)}`,
  );
}

export function setSchoolClassTeacher(
  input:
    | { kind: "class"; programId: string; classLevel: number; teacherId: string | null }
    | {
        kind: "section";
        sectionId: string;
        teacherId: string | null;
        applyToClass?: boolean;
      },
) {
  return schoolApi<unknown>(`${SCHOOL_BASE}/class-teacher`, {
    method: "PUT",
    body: input,
  });
}
