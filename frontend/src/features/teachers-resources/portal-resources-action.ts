"use server";

import { verifySchoolSession } from "@/features/school-auth/session";
import {
  programCodesFromSlots,
  resourceSlotsFromSchool,
} from "@/features/schools/content-slots";
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

function payloadFromSlots(
  slots: ReturnType<typeof resourceSlotsFromSchool>,
  assignments: TeacherAssignment[],
): PortalResourcesPayload {
  const programCodes = programCodesFromSlots(slots);
  return {
    programIds: portalProgramIds(programCodes),
    catalogIds: regularCatalogIds(programCodes),
    programNames: namesFrom([...slots, ...assignments]),
    subjectIds: [...new Set(assignments.map((row) => row.subject))],
    assignments,
  };
}

/** School Teachers Resources — one enrolled class on a program is enough to show it. */
export async function loadSchoolPortalResourcesAction(): Promise<PortalResourcesPayload> {
  const school = await verifySchoolSession();
  const slots = resourceSlotsFromSchool(school.schoolPrograms);
  const assignments: TeacherAssignment[] = slots.flatMap((slot) =>
    slot.subjects.map((subject) => ({
      programId: slot.programId,
      programCode: slot.programCode,
      programName: slot.programName,
      classLevel: slot.classLevel,
      subject,
    })),
  );
  return payloadFromSlots(slots, assignments);
}

/** Teacher portal — enrolled school classes ∩ this teacher's assignments. */
export async function loadTeacherPortalResourcesAction(): Promise<PortalResourcesPayload> {
  const teacher = await verifyTeacherSession();
  const schoolSlots = resourceSlotsFromSchool(teacher.school.schoolPrograms);
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
  return payloadFromSlots(slots, assignments);
}
