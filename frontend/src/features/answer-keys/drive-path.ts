import { ANSWER_KEYS_PATH } from "./constants";
import type { SchoolType } from "@/types/school";

export type DrivePath = {
  /** Regular catalog program folder. */
  program?: string;
  /** Customized school folder. */
  schoolId?: string;
  testNumber?: number;
  /** Class row within a test (upload target). */
  classLevel?: number;
};

export type DriveSchool = {
  id: string;
  name: string;
  code: string;
  type: SchoolType;
  programs?: string[];
  offerings?: Array<{ code: string; name: string; classLevels: number[] }>;
};

export const DRIVE_TESTS = Array.from({ length: 18 }, (_, index) => index + 1);

export const ANSWER_KEYS_FOLDER_STORAGE = "vitaran:answer-keys-folder";

export function answerKeysFolderHref(
  path: DrivePath,
  programs: Array<{ code: string; type?: string }> = [],
) {
  const params = new URLSearchParams();
  const programType = programs.find((program) => program.code === path.program)?.type;
  const type = programType ?? (path.schoolId ? "CUSTOMIZED" : path.program ? "REGULAR" : undefined);
  if (type) params.set("type", type);
  if (path.program) params.set("program", path.program);
  if (path.schoolId) params.set("school", path.schoolId);
  if (path.testNumber) params.set("test", String(path.testNumber));
  const query = params.toString();
  return query ? `${ANSWER_KEYS_PATH}?${query}` : ANSWER_KEYS_PATH;
}

export function isAnswerKeysFolderHref(href: string) {
  if (!href.startsWith(ANSWER_KEYS_PATH) || href.includes("://")) return false;
  const pathOnly = href.split("?")[0];
  return pathOnly === ANSWER_KEYS_PATH;
}

/** Last drive folder, so Back from an answer key returns there instead of home. */
export function readAnswerKeysReturnHref() {
  if (typeof window === "undefined") return null;
  const from = new URLSearchParams(window.location.search).get("from");
  if (from && isAnswerKeysFolderHref(from)) return from;
  try {
    const stored = window.sessionStorage.getItem(ANSWER_KEYS_FOLDER_STORAGE);
    if (stored && isAnswerKeysFolderHref(stored)) return stored;
  } catch {
    // ignore
  }
  return null;
}
