import { subjectsForClassLevel } from "@/features/schools/constants";
import type { SchoolProgramOffering } from "@/types/program";

/** Subjects for class report menus — offerings first, then catalog band defaults. */
export function subjectsForSchoolClass(
  programs: SchoolProgramOffering[] | undefined,
  classLevel: number,
  programId?: string,
): string[] {
  if (programs?.length) {
    if (programId) {
      const program = programs.find((row) => row.programId === programId);
      const fromClass = program?.classes.find((row) => row.classLevel === classLevel)?.subjects;
      if (fromClass?.length) return fromClass.map(String);
      if (program?.catalogSubjects?.length) return program.catalogSubjects.map(String);
    }
    const labels = new Set<string>();
    for (const program of programs) {
      const row = program.classes.find((entry) => entry.classLevel === classLevel);
      for (const subject of row?.subjects ?? program.catalogSubjects ?? []) {
        labels.add(String(subject));
      }
    }
    if (labels.size) return [...labels];
  }
  return subjectsForClassLevel(classLevel);
}
