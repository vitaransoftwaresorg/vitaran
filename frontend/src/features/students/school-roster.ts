import type { SchoolOption } from "@/types/school";
import type { Student } from "@/types/student";

export const STUDENTS_PATH = "/admin/schools/students";

/** Only students on programs this school is enrolled in (drops orphaned regular-program rows). */
export function studentsForSchoolOfferings(school: SchoolOption, students: Student[]) {
  const allowed = new Set(
    (school.offerings?.length ? school.offerings.map((row) => row.code) : school.programs) ?? [],
  );
  if (allowed.size === 0) return students;
  return students.filter((student) => allowed.has(student.programCode));
}
