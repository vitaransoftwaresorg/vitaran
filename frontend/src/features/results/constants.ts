import { programLabel } from "@/features/schools/constants";
import type { ResultSet } from "@/types/result";

export const RESULTS_PATH = "/admin/results";
export const RESULT_ENTER_PATH = `${RESULTS_PATH}/enter`;
/** School portal results. */
export const SCHOOL_RESULTS_PATH = "/school/results";

/** Teacher portal results. */
export const TEACHER_RESULTS_PATH = "/teacher/results";

/** Public site results (when admin sets Results → Public). */
export const PUBLIC_RESULTS_PATH = "/results";

/** Class student table for manual marks. */
export const resultEnterHref = (params: {
  schoolId: string;
  program?: string;
  testNumber: number;
  classLevel: number;
  /** When sections have different Test IDs / programs — scope enter to that section. */
  sectionId?: string | null;
}) => {
  const search = new URLSearchParams({
    school: params.schoolId,
    test: String(params.testNumber),
    class: String(params.classLevel),
  });
  if (params.program) search.set("program", params.program);
  if (params.sectionId) search.set("section", params.sectionId);
  return `${RESULT_ENTER_PATH}?${search}`;
};

/** `basePath` is `/admin/results` or `/results`. */
export const resultSetHref = (
  basePath: string,
  id: string,
  classLevel?: number,
  schoolCode?: string,
  /** Drive folder to return to (e.g. `/school/results?test=3`). */
  from?: string,
) => {
  const query = new URLSearchParams();
  if (classLevel != null) query.set("class", String(classLevel));
  if (schoolCode?.trim()) query.set("school", schoolCode.trim());
  if (from?.trim()) query.set("from", from.trim());
  const suffix = query.size ? `?${query}` : "";
  return `${basePath}/${id}${suffix}`;
};
export const resultSheetDownloadHref = (basePath: string, id: string, classLevel: number) =>
  `${basePath}/${id}/classes/${classLevel}/file`;

export const resultProgramLabel = ({ program, programName }: Pick<ResultSet, "program" | "programName">) =>
  programLabel(program ?? "", programName);

export const studentCount = (count: number) => `${count} ${count === 1 ? "student" : "students"}`;
