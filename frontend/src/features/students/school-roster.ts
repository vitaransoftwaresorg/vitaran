import {
  DEFAULT_SECTION_NAME,
  displaySectionName,
} from "@/features/schools/section-label";
import type { ClassOrganization } from "@/types/section";
import type { SchoolOption } from "@/types/school";
import type { Student } from "@/types/student";

export const STUDENTS_PATH = "/admin/schools/students";

/**
 * App-wide rule: there is one school student roster.
 * Students / Classes / Results / OMR / ranks / reports all slice that same list.
 * Deleting a student, section, or class removes those rolls from Results and OMR too.
 */

/** Filter a school roster to enrolled program codes (empty set = keep all). */
export function filterStudentsByProgramCodes(
  students: Student[],
  programCodes: string[] | undefined | null,
) {
  const allowed = new Set(programCodes ?? []);
  if (allowed.size === 0) return students;
  return students.filter((student) => allowed.has(student.programCode));
}

/** @deprecated Prefer the full ACTIVE school roster so Results and Students stay aligned. */
export function studentsForSchoolOfferings(school: SchoolOption, students: Student[]) {
  const codes =
    (school.offerings?.length ? school.offerings.map((row) => row.code) : school.programs) ?? [];
  return filterStudentsByProgramCodes(students, codes);
}

/** One class (optional section) from a full school roster — shared by admin and school drives. */
export function studentsInClass(
  students: Student[],
  classLevel: number,
  section?: string,
  options?: { sectionIds?: string[] },
) {
  const wanted = section?.trim().toUpperCase();
  return students
    .filter((student) => {
      if (student.classLevel !== classLevel) return false;
      if (!wanted) return true;
      // Prefer section id when the class organization is known (avoids name mismatches).
      if (options?.sectionIds?.length) {
        if (student.sectionId && options.sectionIds.includes(student.sectionId)) return true;
        // Whole-class students (no section row) display as the default section letter.
        if (!student.sectionId && wanted === DEFAULT_SECTION_NAME) return true;
        return false;
      }
      return displaySectionName(student.sectionName).toUpperCase() === wanted;
    })
    .sort(
      (a, b) =>
        displaySectionName(a.sectionName).localeCompare(displaySectionName(b.sectionName)) ||
        a.rollNo.localeCompare(b.rollNo),
    );
}

/**
 * Planned seat capacity for a class.
 * With sections: sum of section seats (e.g. 4 × 50 = 200) — whole-class seats ignored.
 * Without sections: whole-class seats for that level.
 */
export function seatsForClass(
  organization: ClassOrganization | null | undefined,
  classLevel: number,
  section?: string,
) {
  if (!organization) return 0;
  if (section) {
    return organization.sections
      .filter(
        (row) =>
          row.classLevel === classLevel &&
          displaySectionName(row.name).toUpperCase() === section.toUpperCase(),
      )
      .reduce((sum, row) => sum + row.studentCount, 0);
  }
  const classSections = organization.sections.filter((row) => row.classLevel === classLevel);
  if (classSections.length > 0) {
    return classSections.reduce((sum, row) => sum + row.studentCount, 0);
  }
  return organization.wholeClasses
    .filter((row) => row.classLevel === classLevel)
    .reduce((sum, row) => sum + row.studentCount, 0);
}
