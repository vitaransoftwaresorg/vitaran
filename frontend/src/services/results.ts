import "server-only";
import { ApiError } from "@/services/api-client";
import { adminApi, adminFetch } from "@/services/admin-api";
import { listFiltersQuery, type ListFilters } from "@/services/list-filters";
import { schoolApi, schoolFetch } from "@/services/school-api";
import { teacherApi, teacherFetch } from "@/services/teacher-api";
import type { ContentStats } from "@/types/document";
import type { ResultCell, ResultSet, ResultSheet } from "@/types/result";

const BASE = "/results";
const SCHOOL_BASE = "/school/results";
const TEACHER_BASE = "/teacher/results";
const setPath = (base: string, id: string) => `${base}/${encodeURIComponent(id)}`;
const sheetPath = (base: string, id: string, classLevel: number) =>
  `${setPath(base, id)}/classes/${classLevel}`;

/** Treats bad and unknown ids alike so pages can show a 404. */
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function listResultSets(filters?: ListFilters) {
  return adminApi<ResultSet[]>(`${BASE}${listFiltersQuery(filters)}`);
}

export function getResultStats() {
  return adminApi<ContentStats>(`${BASE}/stats`);
}

export function getResultSet(id: string) {
  return orNull(adminApi<ResultSet>(setPath(BASE, id)));
}

/** `form` carries the text fields and one `class_N` file per uploaded class. */
export type ManualResultSheetInput = {
  schoolId: string;
  program?: string;
  programName?: string;
  testId: string;
  testNumber: number;
  classLevel: number;
  resultSetId?: string;
  columns: string[];
  rows: ResultCell[][];
};

/** Admin class table: create/update one class; the API recalculates totals and ranks. */
export function saveManualResultSheet(input: ManualResultSheetInput) {
  return adminApi<ResultSet>(`${BASE}/manual`, { method: "POST", body: input });
}

/** Columns for a class table: the saved sheet's, or the answer key's subjects. */
export function getClassResultTemplate(query: {
  schoolId: string;
  program?: string;
  programName?: string;
  testNumber: number;
  classLevel: number;
}) {
  const params = new URLSearchParams({
    schoolId: query.schoolId,
    testNumber: String(query.testNumber),
    classLevel: String(query.classLevel),
  });
  if (query.program) params.set("program", query.program);
  if (query.programName) params.set("programName", query.programName);
  return adminApi<{ columns: string[] }>(`${BASE}/class-template?${params}`);
}

export function setResultSetPublished(id: string, published: boolean) {
  return adminApi<ResultSet>(`${setPath(BASE, id)}/publish`, { method: "PATCH", body: { published } });
}

export function deleteResultSet(id: string) {
  return adminApi<void>(setPath(BASE, id), { method: "DELETE" });
}

export function getResultSheet(id: string, classLevel: number) {
  return orNull(adminApi<ResultSheet>(sheetPath(BASE, id, classLevel)));
}

export function fetchResultSheetFile(id: string, classLevel: number) {
  return adminFetch(`${sheetPath(BASE, id, classLevel)}/file`);
}

/** The whole class in rank order as one printable PDF (notice board). */
export function fetchClassResultPdf(id: string, classLevel: number, portal: "admin" | "school" | "teacher" = "admin") {
  const [base, fetcher] =
    portal === "school"
      ? [SCHOOL_BASE, schoolFetch]
      : portal === "teacher"
        ? [TEACHER_BASE, teacherFetch]
        : [BASE, adminFetch];
  return fetcher(`${sheetPath(base, id, classLevel)}/result-pdf`);
}

/** Rank card(s): one student by roll number, or the whole class; PDF or a JPG preview. */
export function fetchRankCards(
  id: string,
  classLevel: number,
  options: { roll?: string; format: "pdf" | "jpg" },
  portal: "admin" | "school" | "teacher" = "admin",
) {
  const query = new URLSearchParams({ format: options.format });
  if (options.roll) query.set("roll", options.roll);
  const [base, fetcher] =
    portal === "school"
      ? [SCHOOL_BASE, schoolFetch]
      : portal === "teacher"
        ? [TEACHER_BASE, teacherFetch]
        : [BASE, adminFetch];
  return fetcher(`${sheetPath(base, id, classLevel)}/rank-cards?${query}`);
}

/** Only the signed-in school's own results. */
export function listSchoolResultSets() {
  return schoolApi<ResultSet[]>(SCHOOL_BASE);
}

export function getSchoolResultSet(id: string) {
  return orNull(schoolApi<ResultSet>(setPath(SCHOOL_BASE, id)));
}

export function getSchoolResultSheet(id: string, classLevel: number) {
  return orNull(schoolApi<ResultSheet>(sheetPath(SCHOOL_BASE, id, classLevel)));
}

export function fetchSchoolResultSheetFile(id: string, classLevel: number) {
  return schoolFetch(`${sheetPath(SCHOOL_BASE, id, classLevel)}/file`);
}

export function listTeacherResultSets() {
  return teacherApi<ResultSet[]>(TEACHER_BASE);
}

export function getTeacherResultSet(id: string) {
  return orNull(teacherApi<ResultSet>(setPath(TEACHER_BASE, id)));
}

export function getTeacherResultSheet(id: string, classLevel: number) {
  return orNull(teacherApi<ResultSheet>(sheetPath(TEACHER_BASE, id, classLevel)));
}

export function fetchTeacherResultSheetFile(id: string, classLevel: number) {
  return teacherFetch(`${sheetPath(TEACHER_BASE, id, classLevel)}/file`);
}
