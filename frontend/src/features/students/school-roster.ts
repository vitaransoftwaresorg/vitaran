import { displaySectionName } from "@/features/schools/section-label";
import type { SchoolOption } from "@/types/school";
import type { Student } from "@/types/student";

export const STUDENTS_PATH = "/admin/schools/students";

/** Filter a school roster to enrolled program codes (empty set = keep all). */
export function filterStudentsByProgramCodes(
  students: Student[],
  programCodes: string[] | undefined | null,
) {
  const allowed = new Set(programCodes ?? []);
  if (allowed.size === 0) return students;
  return students.filter((student) => allowed.has(student.programCode));
}

/** Only students on programs this school is enrolled in (drops orphaned regular-program rows). */
export function studentsForSchoolOfferings(school: SchoolOption, students: Student[]) {
  const codes =
    (school.offerings?.length ? school.offerings.map((row) => row.code) : school.programs) ?? [];
  return filterStudentsByProgramCodes(students, codes);
}

/** One class (optional section) from a full school roster — shared by admin and school drives. */
export function studentsInClass(students: Student[], classLevel: number, section?: string) {
  return students
    .filter((student) => {
      if (student.classLevel !== classLevel) return false;
      if (!section) return true;
      return displaySectionName(student.sectionName) === section;
    })
    .sort(
      (a, b) =>
        displaySectionName(a.sectionName).localeCompare(displaySectionName(b.sectionName)) ||
        a.rollNo.localeCompare(b.rollNo),
    );
}
