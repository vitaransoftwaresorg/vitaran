import type { SchoolProgramOffering } from "@/types/program";
import type { Subject } from "@/types/school";
import type { ClassOrganization } from "@/types/section";

export type ContentSlot = {
  programId: string;
  programCode: string;
  programName: string;
  classLevel: number;
  subjects: Subject[];
};

/** Programs & classes ∩ Classes & sections — school/teacher content scope. */
export function contentSlotsFromSchool(
  schoolPrograms: SchoolProgramOffering[],
  organization: ClassOrganization | null | undefined,
): ContentSlot[] {
  const orgKeys = new Set<string>();
  for (const row of organization?.wholeClasses ?? []) {
    orgKeys.add(`${row.programId}:${row.classLevel}`);
  }
  for (const row of organization?.sections ?? []) {
    orgKeys.add(`${row.programId}:${row.classLevel}`);
  }

  return schoolPrograms.flatMap((program) =>
    program.classes
      .filter((cls) => orgKeys.has(`${program.programId}:${cls.classLevel}`))
      .map((cls) => ({
        programId: program.programId,
        programCode: program.programCode,
        programName: program.programName,
        classLevel: cls.classLevel,
        subjects: cls.subjects,
      })),
  );
}

export function programCodesFromSlots(slots: ContentSlot[]) {
  return [...new Set(slots.map((slot) => slot.programCode))];
}
