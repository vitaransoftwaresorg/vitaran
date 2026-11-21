import "server-only";
import { ApiError, apiClient, buildApiUrl } from "@/services/api-client";
import { adminApi, adminFetch } from "@/services/admin-api";
import { listFiltersQuery, type ListFilters } from "@/services/list-filters";
import { schoolApi, schoolFetch } from "@/services/school-api";
import { teacherApi, teacherFetch } from "@/services/teacher-api";
import type {
  AnswerKey,
  AnswerKeyDetail,
  AnswerKeyInput,
  AnswerKeyOmrStatus,
  AnswerOption,
  KeyTypeRange,
  ParsedAnswerKeyImport,
  SchoolTestOption,
  SubjectRange,
  TestIdAvailability,
} from "@/types/answer-key";
import type {
  AnswerKeyObjection,
  AnswerKeyObjectionList,
  AnswerKeyObjectionStatus,
  ResolveAnswerKeyObjectionInput,
  ResolveAnswerKeyObjectionResult,
} from "@/types/answer-key-objection";
import type { ContentStats } from "@/types/document";

const BASE = "/answer-keys";
const PUBLIC_BASE = "/public/answer-keys";
const SCHOOL_BASE = "/school/answer-keys";
const TEACHER_BASE = "/teacher/answer-keys";
const itemPath = (base: string, id: string) => `${base}/${encodeURIComponent(id)}`;

/** Key metadata goes in the query string; answers are entered afterwards in the editor. */
function metaQuery(input: AnswerKeyInput) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query;
}

export function listRecentAnswerKeys(filters?: ListFilters) {
  return adminApi<AnswerKey[]>(`${BASE}${listFiltersQuery(filters)}`);
}

/** Tests + program/class combos for a school, from its answer keys. */
export function listSchoolTests(schoolId: string) {
  const query = new URLSearchParams({ schoolId });
  return adminApi<SchoolTestOption[]>(`${BASE}/school-tests?${query}`);
}

export type SchoolSectionKeyBoard = {
  school: { id: string; name: string; code: string };
  sectionId: string | null;
  sectionName: string | null;
  classLevel: number;
  programCode: string;
  items: Array<{ platform: AnswerKey; schoolKey: AnswerKey | null }>;
};

/** Platform keys + school overrides for one section (or whole class). */
export function listSchoolSectionKeys(input: {
  schoolId: string;
  sectionId?: string;
  classLevel?: number;
}) {
  const query = new URLSearchParams({ schoolId: input.schoolId });
  if (input.sectionId) query.set("sectionId", input.sectionId);
  if (input.classLevel != null) query.set("classLevel", String(input.classLevel));
  return adminApi<SchoolSectionKeyBoard>(`${BASE}/school-section-keys?${query}`);
}

/** Clone / reopen a school section key from a platform answer key. */
export function ensureSchoolSectionKey(input: {
  platformKeyId: string;
  schoolId: string;
  sectionId?: string | null;
}) {
  return adminApi<AnswerKey>(`${BASE}/school-section-keys`, {
    method: "POST",
    body: input,
  });
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

export function getAnswerKeyOmrStatus(id: string) {
  return adminApi<AnswerKeyOmrStatus>(`${itemPath(BASE, id)}/omr-status`);
}

export function createAnswerKey(input: AnswerKeyInput) {
  return adminApi<AnswerKey>(`${BASE}?${metaQuery(input)}`, { method: "POST" });
}

export function updateAnswerKey(id: string, input: AnswerKeyInput) {
  return adminApi<AnswerKey>(`${itemPath(BASE, id)}?${metaQuery(input)}`, { method: "PATCH" });
}

export function setAnswerKeyPublished(id: string, published: boolean) {
  return adminApi<AnswerKey>(`${itemPath(BASE, id)}/publish`, { method: "PATCH", body: { published } });
}

export function checkAnswerKeyTestId(testId: string, exceptId?: string) {
  const query = new URLSearchParams({ testId });
  if (exceptId) query.set("exceptId", exceptId);
  return adminApi<TestIdAvailability>(`${BASE}/test-id/check?${query}`);
}

export function setAnswerKeyTestId(id: string, testId: string) {
  return adminApi<AnswerKey>(`${itemPath(BASE, id)}/test-id`, { method: "PATCH", body: { testId } });
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
    keyTypeRanges?: KeyTypeRange[];
    testId?: string;
    correctMarks: number;
    wrongMarks: number;
  },
) {
  return adminApi<AnswerKeyDetail>(`${itemPath(BASE, id)}/answers`, { method: "PATCH", body: input });
}

/** Parse answers from a PDF in memory — the file is not stored. */
export function parseAnswerKeyPdf(file: File) {
  const body = new FormData();
  body.append("pdf", file);
  return adminApi<ParsedAnswerKeyImport>(`${BASE}/parse-pdf`, { method: "POST", body });
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

/** Keys for the signed-in teacher's assigned classes. */
export function listTeacherAnswerKeys() {
  return teacherApi<AnswerKey[]>(TEACHER_BASE);
}

/** Published regular keys when admin sets Answer keys → Public. */
export function listPublicAnswerKeys() {
  return apiClient<AnswerKey[]>(PUBLIC_BASE, { cache: "no-store" });
}

export async function getPublicAnswerKey(id: string): Promise<AnswerKeyDetail | null> {
  try {
    return await apiClient<AnswerKeyDetail>(itemPath(PUBLIC_BASE, id), { cache: "no-store" });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}

export function fetchPublicAnswerKeyPdf(id: string) {
  return fetch(buildApiUrl(`${itemPath(PUBLIC_BASE, id)}/pdf`), {
    cache: "no-store",
    headers: { Accept: "application/pdf" },
  });
}

export async function getTeacherAnswerKey(id: string): Promise<AnswerKeyDetail | null> {
  try {
    return await teacherApi<AnswerKeyDetail>(itemPath(TEACHER_BASE, id));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

/** Branded answer key PDF with the Vitaran and school logos. */
export function fetchSchoolAnswerKeyPdf(id: string) {
  return schoolFetch(`${itemPath(SCHOOL_BASE, id)}/pdf`);
}

export function fetchTeacherAnswerKeyPdf(id: string) {
  return teacherFetch(`${itemPath(TEACHER_BASE, id)}/pdf`);
}

/** Admin printable/downloadable answer key PDF. */
export function fetchAdminAnswerKeyPdf(id: string) {
  return adminFetch(`${itemPath(BASE, id)}/pdf`);
}

export function listSchoolAnswerKeyObjections(answerKeyId: string) {
  return schoolApi<AnswerKeyObjection[]>(`${itemPath(SCHOOL_BASE, answerKeyId)}/objections`);
}

/** `form` carries the objection fields plus an optional `image` file. */
export function raiseSchoolAnswerKeyObjection(answerKeyId: string, form: FormData) {
  return schoolApi<AnswerKeyObjection>(`${itemPath(SCHOOL_BASE, answerKeyId)}/objections`, {
    method: "POST",
    body: form,
  });
}

export function fetchSchoolObjectionImage(objectionId: string) {
  return schoolFetch(`${SCHOOL_BASE}/objections/${encodeURIComponent(objectionId)}/image`);
}

export function listTeacherAnswerKeyObjections(answerKeyId: string) {
  return teacherApi<AnswerKeyObjection[]>(`${itemPath(TEACHER_BASE, answerKeyId)}/objections`);
}

export function raiseTeacherAnswerKeyObjection(answerKeyId: string, form: FormData) {
  return teacherApi<AnswerKeyObjection>(`${itemPath(TEACHER_BASE, answerKeyId)}/objections`, {
    method: "POST",
    body: form,
  });
}

export function fetchTeacherObjectionImage(objectionId: string) {
  return teacherFetch(`${TEACHER_BASE}/objections/${encodeURIComponent(objectionId)}/image`);
}

export function fetchAdminObjectionImage(objectionId: string) {
  return adminFetch(`${BASE}/objections/${encodeURIComponent(objectionId)}/image`);
}

export function listAdminAnswerKeyObjections(params?: {
  status?: AnswerKeyObjectionStatus;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const suffix = query.size ? `?${query}` : "";
  return adminApi<AnswerKeyObjectionList>(`${BASE}/objections${suffix}`);
}

export function getOpenObjectionCount() {
  return adminApi<{ open: number }>(`${BASE}/objections/open-count`);
}

export function resolveAdminAnswerKeyObjection(
  id: string,
  input: ResolveAnswerKeyObjectionInput,
) {
  return adminApi<ResolveAnswerKeyObjectionResult>(
    `${BASE}/objections/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: input,
    },
  );
}
