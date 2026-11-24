"use server";

import { verifySchoolSession } from "@/features/school-auth/session";
import {
  contentSlotsFromSchool,
  programCodesFromSlots,
} from "@/features/schools/content-slots";
import { verifyTeacherSession } from "@/features/teacher-auth/session";
import {
  listSchoolClassOrganization,
  listTeacherClassOrganization,
} from "@/services/sections";
import type { Subject } from "@/types/school";
import type { TeacherAssignment } from "@/types/teacher";
import { loadSolutionBooksFromDb } from "./load-solution-books";
import { portalProgramIds, regularCatalogIds } from "./portal-programs";
import type { SolutionBook } from "./solution-books";

export type PortalResourcesPayload = {
  programIds: string[];
  catalogIds: string[];
  programNames: Record<string, string>;
  subjectIds: Subject[];
  assignments: TeacherAssignment[];
  books: Record<string, SolutionBook[]>;
};

function namesFrom(
  rows: Array<{ programCode: string; programName: string }>,
): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.programCode, row.programName]));
}

/**
 * School Teachers Resources — program shows only when the school has at least one
 * class/section for that program (Programs & classes ∩ Classes & sections).
 */
export async function loadSchoolPortalResourcesAction(): Promise<PortalResourcesPayload> {
  const school = await verifySchoolSession();
  const organization = await listSchoolClassOrganization();
  const slots = contentSlotsFromSchool(school.schoolPrograms, organization);
  const assignments: TeacherAssignment[] = slots.flatMap((slot) =>
    slot.subjects.map((subject) => ({
      programId: slot.programId,
      programCode: slot.programCode,
      programName: slot.programName,
      classLevel: slot.classLevel,
      subject,
    })),
  );
  const programCodes = programCodesFromSlots(slots);
  // Customized schools use school-uploaded PDFs only — never shared regular solution books.
  const isCustomized = (school.type ?? "REGULAR") === "CUSTOMIZED";
  const books = isCustomized ? {} : await loadSolutionBooksFromDb();

  return {
    programIds: isCustomized ? [] : portalProgramIds(programCodes),
    catalogIds: isCustomized ? [] : regularCatalogIds(programCodes),
    programNames: namesFrom(slots),
    subjectIds: [...new Set(assignments.map((row) => row.subject))],
    assignments,
    books,
  };
}

/** Teacher portal — enrolled school classes ∩ this teacher's assignments. */
export async function loadTeacherPortalResourcesAction(): Promise<PortalResourcesPayload> {
  const teacher = await verifyTeacherSession();
  const organization = await listTeacherClassOrganization();
  const schoolSlots = contentSlotsFromSchool(teacher.school.schoolPrograms, organization);
  const teacherKeys = new Set(
    teacher.assignments.map((row) => `${row.programCode}:${row.classLevel}`),
  );
  const slots = schoolSlots.filter((slot) =>
    teacherKeys.has(`${slot.programCode}:${slot.classLevel}`),
  );
  const assignments = teacher.assignments.filter((row) =>
    slots.some(
      (slot) =>
        slot.programCode === row.programCode && slot.classLevel === row.classLevel,
    ),
  );
  const programCodes = programCodesFromSlots(slots);
  // Customized schools use school-uploaded PDFs only — never shared regular solution books.
  const isCustomized = (teacher.school.type ?? "REGULAR") === "CUSTOMIZED";
  const books = isCustomized ? {} : await loadSolutionBooksFromDb();

  return {
    programIds: isCustomized ? [] : portalProgramIds(programCodes),
    catalogIds: isCustomized ? [] : regularCatalogIds(programCodes),
    programNames: namesFrom([...slots, ...assignments]),
    subjectIds: [...new Set(assignments.map((row) => row.subject))],
    assignments,
    books,
  };
}
