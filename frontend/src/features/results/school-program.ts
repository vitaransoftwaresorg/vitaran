import type { LearningProgram } from "@/types/program";
import type { DriveSchool } from "./drive-path";

/** True when the catalog code is a REGULAR program (unknown codes are treated as customized). */
export function isRegularProgramCode(code: string | undefined, programs: LearningProgram[]) {
  if (!code) return false;
  return programs.find((program) => program.code === code)?.type === "REGULAR";
}

/** Offerings a school may use for results — customized schools never get regular catalog programs. */
export function resultOfferingsForSchool(school: DriveSchool | undefined, programs: LearningProgram[]) {
  const offerings = school?.offerings ?? [];
  if (!school || school.type !== "CUSTOMIZED") return offerings;
  return offerings.filter((offering) => !isRegularProgramCode(offering.code, programs));
}

/** Fields to send when saving/uploading results for this school + optional path program. */
export function resultProgramFields(
  school: DriveSchool,
  programs: LearningProgram[],
  pathProgram?: string,
): { program?: string; programName?: string } {
  if (school.type !== "CUSTOMIZED") {
    return { program: pathProgram };
  }

  const offerings = resultOfferingsForSchool(school, programs);
  const preferred =
    (pathProgram && !isRegularProgramCode(pathProgram, programs)
      ? offerings.find((row) => row.code === pathProgram)
      : undefined) ?? offerings[0];

  if (preferred && !isRegularProgramCode(preferred.code, programs)) {
    return { program: preferred.code, programName: preferred.name };
  }

  const name =
    preferred?.name ??
    (pathProgram && !isRegularProgramCode(pathProgram, programs)
      ? school.programLabels?.[pathProgram]
      : undefined) ??
    school.name;

  return { programName: name };
}
