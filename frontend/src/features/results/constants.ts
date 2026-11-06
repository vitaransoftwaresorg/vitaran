import { programLabel } from "@/features/schools/constants";
import type { ResultSet } from "@/types/result";

export const RESULTS_PATH = "/admin/results";
export const RESULT_UPLOAD_PATH = `${RESULTS_PATH}/upload`;
export const RESULT_ENTER_PATH = `${RESULTS_PATH}/enter`;
/** School portal results. */
export const SCHOOL_RESULTS_PATH = "/school/results";

/** Teacher portal results. */
export const TEACHER_RESULTS_PATH = "/teacher/results";

export const EXCEL_MAX_BYTES = 2 * 1024 * 1024;
export const EXCEL_ACCEPT =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type ClassLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Multipart field carrying a class's spreadsheet; the API expects the same names. */
export const classFileField = (level: number) => `class_${level}` as `class_${ClassLevel}`;

/** Upload form with the school pre-selected; it returns to the school's page afterwards. */
export const resultUploadHrefFor = (schoolId: string) =>
  `${RESULT_UPLOAD_PATH}?${new URLSearchParams({ schoolId })}`;

/** Class student table for manual marks (+ Import Excel). */
export const resultEnterHref = (params: {
  schoolId: string;
  program?: string;
  testNumber: number;
  classLevel: number;
}) => {
  const search = new URLSearchParams({
    school: params.schoolId,
    test: String(params.testNumber),
    class: String(params.classLevel),
  });
  if (params.program) search.set("program", params.program);
  return `${RESULT_ENTER_PATH}?${search}`;
};

/** `basePath` is `/admin/results` or `/results`. */
export const resultSetHref = (basePath: string, id: string, classLevel?: number) =>
  classLevel ? `${basePath}/${id}?class=${classLevel}` : `${basePath}/${id}`;
export const resultEditHref = (id: string) => `${RESULTS_PATH}/${id}/edit`;
export const resultSheetDownloadHref = (basePath: string, id: string, classLevel: number) =>
  `${basePath}/${id}/classes/${classLevel}/file`;

export const resultProgramLabel = ({ program, programName }: Pick<ResultSet, "program" | "programName">) =>
  programLabel(program ?? "", programName);

export const studentCount = (count: number) => `${count} ${count === 1 ? "student" : "students"}`;
