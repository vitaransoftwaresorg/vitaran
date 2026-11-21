"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { ADMIN_BASE_PATH, SCHOOL_BASE_PATH } from "@/constants/auth";
import { ApiError } from "@/services/api-client";
import * as programService from "@/services/programs";
import * as schoolService from "@/services/schools";
import * as sectionService from "@/services/sections";
import { listSchoolClassTeacherSlots } from "@/services/teachers";
import type { SchoolInput, Subject } from "@/types/school";
import type { SectionInput } from "@/types/section";
import type { ClassTeacherSlot } from "@/types/teacher";

function revalidateSections(schoolId?: string) {
  revalidatePath(`${SCHOOL_BASE_PATH}/classes`, "layout");
  revalidatePath(SCHOOL_BASE_PATH, "layout");
  if (schoolId) {
    revalidatePath(`${ADMIN_BASE_PATH}/schools/${schoolId}`, "layout");
  }
}

export async function loadSchoolSectionsAction(): Promise<{
  organization: Awaited<ReturnType<typeof sectionService.listSchoolClassOrganization>>;
  strength: Awaited<ReturnType<typeof sectionService.getSchoolSectionStrength>>;
  classTeacherSlots: ClassTeacherSlot[];
}> {
  try {
    const [organization, strength, classTeacherSlots] = await Promise.all([
      sectionService.listSchoolClassOrganization(),
      sectionService.getSchoolSectionStrength(),
      listSchoolClassTeacherSlots(),
    ]);
    return { organization, strength, classTeacherSlots };
  } catch {
    return {
      organization: { wholeClasses: [], sections: [] },
      strength: { studentStrength: null, used: 0, remaining: null },
      classTeacherSlots: [],
    };
  }
}

export async function createAdminSectionAction(schoolId: string, input: SectionInput) {
  try {
    const result = await sectionService.createAdminSchoolSection(schoolId, input);
    revalidateSections(schoolId);
    return { ok: true as const, result };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not create class/section." };
  }
}

/** Set subject access for one program + class on an existing school. */
export async function updateAdminClassSubjectsAction(
  schoolId: string,
  input: {
    programId: string;
    classLevel: number;
    subjects: Subject[];
    /** When moving a class to another program, drop this class from the old program. */
    fromProgramId?: string;
  },
) {
  try {
    const school = await schoolService.getSchool(schoolId);
    if (!school) return { ok: false as const, message: "School not found." };
    if (input.subjects.length === 0) {
      return { ok: false as const, message: "Select at least one subject." };
    }

    const catalog =
      school.schoolPrograms.find((row) => row.programId === input.programId)?.catalogSubjects ??
      (await programService.getProgram(input.programId))?.subjects ??
      [];
    const allowed = new Set(catalog);
    const subjects = [...new Set(input.subjects)].filter(
      (subject) => allowed.size === 0 || allowed.has(subject),
    );
    if (subjects.length === 0) {
      return {
        ok: false as const,
        message:
          allowed.size > 0
            ? "Pick subjects that belong to this program."
            : "Select at least one subject.",
      };
    }
    const fromProgramId =
      input.fromProgramId && input.fromProgramId !== input.programId
        ? input.fromProgramId
        : undefined;

    if (school.type === "CUSTOMIZED") {
      const custom =
        school.schoolPrograms.find((row) => row.type === "CUSTOMIZED") ??
        school.schoolPrograms[0];
      const byClass = new Map(
        (custom?.classes ?? []).map((row) => [row.classLevel, row.subjects] as const),
      );
      byClass.set(input.classLevel, subjects);
      const classes = [...byClass.entries()]
        .map(([classLevel, nextSubjects]) => ({ classLevel, subjects: nextSubjects }))
        .sort((a, b) => a.classLevel - b.classLevel);
      // Program name = school name; creates the catalog program if missing so Programs lists it.
      const programName = (school.name || custom?.programName || "Custom Program").trim();

      await schoolService.updateSchool(schoolId, {
        customProgram: { name: programName, classes },
      } as SchoolInput);
    } else {
      // Admin Add class can grant a catalog program that is not enrolled yet.
      const programs: SchoolInput["programs"] = school.schoolPrograms
        .map((program) => {
          const byClass = new Map(
            program.classes.map((row) => [row.classLevel, row.subjects] as const),
          );
          if (fromProgramId && program.programId === fromProgramId) {
            byClass.delete(input.classLevel);
          }
          if (program.programId === input.programId) {
            byClass.set(input.classLevel, subjects);
          }
          return {
            programId: program.programId,
            classes: [...byClass.entries()]
              .map(([classLevel, nextSubjects]) => ({
                classLevel,
                subjects: nextSubjects,
              }))
              .sort((a, b) => a.classLevel - b.classLevel),
          };
        })
        .filter((row) => row.classes.length > 0);

      if (!programs.some((row) => row.programId === input.programId)) {
        programs.push({
          programId: input.programId,
          classes: [{ classLevel: input.classLevel, subjects }],
        });
      }

      await schoolService.updateSchool(schoolId, { programs } as SchoolInput);
    }

    revalidateSections(schoolId);
    return { ok: true as const };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not update subject access." };
  }
}

export async function deleteAdminSectionAction(schoolId: string, id: string) {
  try {
    await sectionService.deleteAdminSchoolSection(schoolId, id);
    revalidateSections(schoolId);
    return { ok: true as const };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not delete section." };
  }
}

export async function updateAdminSectionAction(
  schoolId: string,
  id: string,
  input: Partial<SectionInput>,
) {
  try {
    const section = await sectionService.updateAdminSchoolSection(schoolId, id, input);
    revalidateSections(schoolId);
    return { ok: true as const, section };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not update section." };
  }
}

export async function updateAdminWholeClassAction(
  schoolId: string,
  id: string,
  input: { programId?: string; studentCount?: number },
) {
  try {
    const row = await sectionService.updateAdminSchoolWholeClass(schoolId, id, input);
    revalidateSections(schoolId);
    return { ok: true as const, class: row };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not update class." };
  }
}
