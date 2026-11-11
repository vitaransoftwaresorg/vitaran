import { programLabel } from "@/features/schools/constants";
import type { ResultSet } from "@/types/result";

export const RESULTS_PATH = "/admin/results";
export const RESULT_ENTER_PATH = `${RESULTS_PATH}/enter`;
/** School portal results. */
export const SCHOOL_RESULTS_PATH = "/school/results";

/** Teacher portal results. */
export const TEACHER_RESULTS_PATH = "/teacher/results";

/** Class student table for manual marks. */
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
export const resultSheetDownloadHref = (basePath: string, id: string, classLevel: number) =>
  `${basePath}/${id}/classes/${classLevel}/file`;

export const resultProgramLabel = ({ program, programName }: Pick<ResultSet, "program" | "programName">) =>
  programLabel(program ?? "", programName);

export const studentCount = (count: number) => `${count} ${count === 1 ? "student" : "students"}`;
