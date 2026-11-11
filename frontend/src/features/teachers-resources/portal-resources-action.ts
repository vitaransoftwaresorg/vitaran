"use server";

import { verifySchoolSession } from "@/features/school-auth/session";
import { verifyTeacherSession } from "@/features/teacher-auth/session";
import type { Subject } from "@/types/school";
import type { TeacherAssignment } from "@/types/teacher";
import { portalProgramIds, regularCatalogIds } from "./portal-programs";

export type PortalResourcesPayload = {
  programIds: string[];
  catalogIds: string[];
  programNames: Record<string, string>;
  subjectIds: Subject[];
  assignments: TeacherAssignment[];
};

function namesFrom(
  rows: Array<{ programCode: string; programName: string }>,
): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.programCode, row.programName]));
}

/** School offerings flattened to class+subject pairs (same shape teachers use). */
export async function loadSchoolPortalResourcesAction(): Promise<PortalResourcesPayload> {
  const school = await verifySchoolSession();
  const assignments: TeacherAssignment[] = school.schoolPrograms.flatMap((program) =>
    program.classes.flatMap((row) =>
      row.subjects.map((subject) => ({
        programId: program.programId,
        programCode: program.programCode,
        programName: program.programName,
        classLevel: row.classLevel,
        subject,
      })),
    ),
  );

  return {
    programIds: portalProgramIds(school.programCodes),
    catalogIds: regularCatalogIds(school.programCodes),
    programNames: namesFrom(school.schoolPrograms),
    subjectIds: [...new Set(assignments.map((row) => row.subject))],
    assignments,
  };
}

export async function loadTeacherPortalResourcesAction(): Promise<PortalResourcesPayload> {
  const teacher = await verifyTeacherSession();
  const assignmentCodes = [...new Set(teacher.assignments.map((row) => row.programCode))];
  const schoolCodes = teacher.school.programCodes;
  return {
    programIds: portalProgramIds(assignmentCodes.length > 0 ? assignmentCodes : schoolCodes),
    catalogIds: regularCatalogIds(schoolCodes.length > 0 ? schoolCodes : assignmentCodes),
    programNames: namesFrom([
      ...teacher.school.schoolPrograms,
      ...teacher.assignments,
    ]),
    subjectIds: [...new Set(teacher.assignments.map((row) => row.subject))],
    assignments: teacher.assignments,
  };
}
