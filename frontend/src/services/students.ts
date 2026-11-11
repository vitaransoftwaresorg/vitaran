import "server-only";
import { ApiError } from "@/services/api-client";
import { adminApi, adminFetch } from "@/services/admin-api";
import { schoolApi, schoolFetch } from "@/services/school-api";
import { teacherApi, teacherFetch } from "@/services/teacher-api";
import type {
  CreateStudentInput,
  CreateStudentsBulkInput,
  CreateStudentsBulkResult,
  Student,
  StudentDetail,
  StudentListResult,
  StudentTestResult,
  UpdateStudentInput,
} from "@/types/student";

type ListParams = {
  schoolId?: string;
  programId?: string;
  classLevel?: number;
  sectionId?: string;
  wholeClass?: boolean;
  status?: string;
  q?: string;
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

export function listSchoolStudents(params?: ListParams) {
  return schoolApi<StudentListResult>(`/school/students${queryString(params)}`);
}

export type SchoolStudentCounts = {
  byProgram: Record<string, number>;
  byClass: { programId: string; classLevel: number; count: number }[];
  bySection: Record<string, number>;
  byWhole: { programId: string; classLevel: number; count: number }[];
};

export function getSchoolStudentCounts() {
  return schoolApi<SchoolStudentCounts>("/school/students/counts");
}

export function getAdminSchoolStudentCounts(schoolId: string) {
  return adminApi<SchoolStudentCounts>(
    `/schools/${encodeURIComponent(schoolId)}/students/counts`,
  );
}

export async function getSchoolStudent(id: string): Promise<StudentDetail | null> {
  try {
    return await schoolApi<StudentDetail>(`/school/students/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function createSchoolStudent(input: CreateStudentInput) {
  return schoolApi<StudentDetail>("/school/students", { method: "POST", body: input });
}

export function createSchoolStudentsBulk(input: CreateStudentsBulkInput) {
  return schoolApi<CreateStudentsBulkResult>("/school/students/bulk", {
    method: "POST",
    body: input,
  });
}

export function updateSchoolStudent(id: string, input: UpdateStudentInput) {
  return schoolApi<StudentDetail>(`/school/students/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteSchoolStudent(id: string) {
  return schoolApi<{ ok: true }>(`/school/students/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listAdminSchoolStudents(schoolId: string, params?: ListParams) {
  return adminApi<StudentListResult>(
    `/schools/${encodeURIComponent(schoolId)}/students${queryString(params)}`,
  );
}

export function listAdminStudents(params?: ListParams) {
  return adminApi<StudentListResult>(`/students${queryString(params)}`);
}

export async function getAdminSchoolStudent(
  schoolId: string,
  id: string,
): Promise<StudentDetail | null> {
  try {
    return await adminApi<StudentDetail>(
      `/schools/${encodeURIComponent(schoolId)}/students/${encodeURIComponent(id)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function createAdminSchoolStudent(schoolId: string, input: CreateStudentInput) {
  return adminApi<StudentDetail>(`/schools/${encodeURIComponent(schoolId)}/students`, {
    method: "POST",
    body: input,
  });
}

export function createAdminSchoolStudentsBulk(
  schoolId: string,
  input: CreateStudentsBulkInput,
) {
  return adminApi<CreateStudentsBulkResult>(
    `/schools/${encodeURIComponent(schoolId)}/students/bulk`,
    { method: "POST", body: input },
  );
}

export function updateAdminSchoolStudent(
  schoolId: string,
  id: string,
  input: UpdateStudentInput,
) {
  return adminApi<StudentDetail>(
    `/schools/${encodeURIComponent(schoolId)}/students/${encodeURIComponent(id)}`,
    { method: "PATCH", body: input },
  );
}

export function deleteAdminSchoolStudent(schoolId: string, id: string) {
  return adminApi<{ ok: true }>(
    `/schools/${encodeURIComponent(schoolId)}/students/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function getAdminStudent(id: string): Promise<StudentDetail | null> {
  try {
    return await adminApi<StudentDetail>(`/students/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function updateAdminStudent(id: string, input: UpdateStudentInput) {
  return adminApi<StudentDetail>(`/students/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteAdminStudent(id: string) {
  return adminApi<{ ok: true }>(`/students/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function listTeacherStudents(params?: ListParams) {
  return teacherApi<StudentListResult>(`/teacher/students${queryString(params)}`);
}

async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function getAdminStudentPerformance(id: string) {
  return adminApi<StudentTestResult[]>(`/students/${encodeURIComponent(id)}/performance`);
}

export function getSchoolStudentPerformance(id: string) {
  return schoolApi<StudentTestResult[]>(`/school/students/${encodeURIComponent(id)}/performance`);
}

/** Teachers only open students in their assigned or class-teacher classes. */
export function getTeacherStudent(id: string) {
  return orNull(teacherApi<StudentDetail>(`/teacher/students/${encodeURIComponent(id)}`));
}

export function getTeacherStudentPerformance(id: string) {
  return teacherApi<StudentTestResult[]>(`/teacher/students/${encodeURIComponent(id)}/performance`);
}

/** Exact registration-number match, used to open a student from a result sheet row. */
export async function findStudentIdByRoll(
  portal: "admin" | "school" | "teacher",
  roll: string,
  schoolId?: string,
) {
  const params = { q: roll, pageSize: 20 };
  const result =
    portal === "school"
      ? await listSchoolStudents(params)
      : portal === "teacher"
        ? await listTeacherStudents(params)
        : await (schoolId ? listAdminSchoolStudents(schoolId, params) : listAdminStudents(params));
  const fold = (value: string) => value.trim().toLowerCase();
  return result.items.find((student) => fold(student.rollNo) === fold(roll))?.id ?? null;
}

export type { Student, StudentDetail, StudentTestResult };

export function fetchAdminStudentPdf(id: string) {
  return adminFetch(`/students/${encodeURIComponent(id)}/pdf`);
}

export function fetchSchoolStudentPdf(id: string) {
  return schoolFetch(`/school/students/${encodeURIComponent(id)}/pdf`);
}

export function fetchTeacherStudentPdf(id: string) {
  return teacherFetch(`/teacher/students/${encodeURIComponent(id)}/pdf`);
}

/** `ids` is a comma-separated list of student ids, in print order. */
export function fetchAdminStudentProfilesPdf(ids: string) {
  return adminFetch(`/students/profiles/pdf?ids=${encodeURIComponent(ids)}`);
}

export function fetchSchoolStudentProfilesPdf(ids: string) {
  return schoolFetch(`/school/students/profiles/pdf?ids=${encodeURIComponent(ids)}`);
}

export function fetchTeacherStudentProfilesPdf(ids: string) {
  return teacherFetch(`/teacher/students/profiles/pdf?ids=${encodeURIComponent(ids)}`);
}
