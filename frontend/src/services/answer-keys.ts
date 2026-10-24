import "server-only";
import { ApiError } from "@/services/api-client";
import { adminApi, adminFetch } from "@/services/admin-api";
import { listFiltersQuery, type ListFilters } from "@/services/list-filters";
import { pdfUploadRequest } from "@/services/pdf-upload";
import { schoolApi, schoolFetch } from "@/services/school-api";
import { teacherApi, teacherFetch } from "@/services/teacher-api";
import type {
  AnswerKey,
  AnswerKeyDetail,
  AnswerKeyInput,
  AnswerOption,
  SchoolTestOption,
  SubjectRange,
} from "@/types/answer-key";
import type { ContentStats } from "@/types/document";

const BASE = "/answer-keys";
const SCHOOL_BASE = "/school/answer-keys";
const TEACHER_BASE = "/teacher/answer-keys";
const itemPath = (base: string, id: string) => `${base}/${encodeURIComponent(id)}`;

const toRequest = ({ file, ...meta }: AnswerKeyInput) => pdfUploadRequest(meta, file);

export function listRecentAnswerKeys(filters?: ListFilters) {
  return adminApi<AnswerKey[]>(`${BASE}${listFiltersQuery(filters)}`);
}

/** Tests + program/class combos for a school, from its answer keys. */
export function listSchoolTests(schoolId: string) {
  const query = new URLSearchParams({ schoolId });
  return adminApi<SchoolTestOption[]>(`${BASE}/school-tests?${query}`);
}

export function getAnswerKeyStats() {
  return adminApi<ContentStats>(`${BASE}/stats`);
}

export async function getAnswerKey(id: string): Promise<AnswerKeyDetail | null> {
  try {
    return await adminApi<AnswerKeyDetail>(itemPath(BASE, id));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function uploadAnswerKey(input: AnswerKeyInput) {
  const { query, init } = toRequest(input);
  return adminApi<AnswerKey>(`${BASE}?${query}`, { method: "POST", ...init });
}

export function updateAnswerKey(id: string, input: AnswerKeyInput) {
  const { query, init } = toRequest(input);
  return adminApi<AnswerKey>(`${itemPath(BASE, id)}?${query}`, { method: "PATCH", ...init });
}

export function setAnswerKeyPublished(id: string, published: boolean) {
  return adminApi<AnswerKey>(`${itemPath(BASE, id)}/publish`, { method: "PATCH", body: { published } });
}

export function deleteAnswerKey(id: string) {
  return adminApi<void>(itemPath(BASE, id), { method: "DELETE" });
}

export function saveAnswerKeyAnswers(
  id: string,
  input: {
    answers: Record<string, AnswerOption | string>;
    explanations: Record<string, string>;
    printedAnswers?: Record<string, AnswerOption | string>;
    subjectRanges: SubjectRange[];
    pattern?: "MAINS" | "ADVANCED";
  },
) {
  return adminApi<AnswerKeyDetail>(`${itemPath(BASE, id)}/answers`, { method: "PATCH", body: input });
}

export function reparseAnswerKey(id: string) {
  return adminApi<AnswerKeyDetail>(`${itemPath(BASE, id)}/parse`, { method: "POST" });
}

export function fetchAnswerKeyFile(id: string) {
  return adminFetch(`${itemPath(BASE, id)}/file`);
}

/** Only the keys the signed-in school may see: regular keys for its programs, or its own. */
export function listSchoolAnswerKeys() {
  return schoolApi<AnswerKey[]>(SCHOOL_BASE);
}

export async function getSchoolAnswerKey(id: string): Promise<AnswerKeyDetail | null> {
  try {
    return await schoolApi<AnswerKeyDetail>(itemPath(SCHOOL_BASE, id));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function fetchSchoolAnswerKeyFile(id: string) {
  return schoolFetch(`${itemPath(SCHOOL_BASE, id)}/file`);
}

/** Keys for the signed-in teacher's assigned classes. */
export function listTeacherAnswerKeys() {
  return teacherApi<AnswerKey[]>(TEACHER_BASE);
}

export async function getTeacherAnswerKey(id: string): Promise<AnswerKeyDetail | null> {
  try {
    return await teacherApi<AnswerKeyDetail>(itemPath(TEACHER_BASE, id));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function fetchTeacherAnswerKeyFile(id: string) {
  return teacherFetch(`${itemPath(TEACHER_BASE, id)}/file`);
}
