import {
  DEFAULT_SECTION_NAME,
  displaySectionName,
} from "@/features/schools/section-label";
import type { ClassOrganization } from "@/types/section";
import type { SchoolOption } from "@/types/school";
import type { SchoolStudentCounts, Student } from "@/types/student";

export const STUDENTS_PATH = "/admin/schools/students";

/**
 * App-wide rule: there is one school student roster (ACTIVE Student rows).
 * Students / Classes / Results / OMR / ranks / reports all slice that same list.
 *
 * Capacity is never the student list:
 * - School strength / seat limit = max seats for the school
 * - Class/section seats = max seats for that class
 * - Roster = real enrolled Student rows (Add / Import)
 *
 * Deleting a student, section, or class removes those rolls from Results and OMR too.
 */

/** UI copy — capacity fields must never say "students". */
export const CAPACITY_LABELS = {
  schoolLimit: "School seat limit",
  schoolLimitHint: "Maximum seats for this school — not the student list.",
  classSeats: "Seat limit",
  seatsAssigned: "seats assigned",
  seatsWord: "seats",
} as const;

export const ROSTER_LABELS = {
  short: "Roster",
  onRoster: "on roster",
  empty: "No students yet",
  chip: "Roster",
} as const;

/** e.g. "12 on roster" / "No students yet" */
export function rosterCountLabel(enrolled: number) {
  if (enrolled <= 0) return ROSTER_LABELS.empty;
  return `${enrolled} ${ROSTER_LABELS.onRoster}`;
}

/** Total ACTIVE students on the school roster (same source Results uses). */
export function rosterTotal(counts: SchoolStudentCounts | null | undefined) {
  if (!counts) return 0;
  return Object.values(counts.byProgram).reduce((sum, n) => sum + n, 0);
}

/** Enrolled roster count for one class/section row (not seat capacity). */
export function rosterCountForClass(
  counts: SchoolStudentCounts | null | undefined,
  row: {
    kind: "section" | "whole";
    id: string;
    programId: string;
    classLevel: number;
  },
) {
  if (!counts) return 0;
  if (row.kind === "section") return counts.bySection[row.id] ?? 0;
  return counts.byWhole
    .filter((item) => item.programId === row.programId && item.classLevel === row.classLevel)
    .reduce((sum, item) => sum + item.count, 0);
}

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

/** Normalize section labels so "A", "a", and "Section A" match. */
export function sectionMatchKey(name: string | null | undefined) {
  return displaySectionName(name)
    .trim()
    .toUpperCase()
    .replace(/^SECTION\s+/, "")
    .trim();
}

/** Section row ids for a class level + section letter/name (handles "A" vs "Section A"). */
export function sectionIdsForClass(
  organization: ClassOrganization | null | undefined,
  classLevel: number,
  section?: string,
) {
  if (!organization || !section) return undefined;
  const wanted = sectionMatchKey(section);
  const ids = organization.sections
    .filter(
      (row) => row.classLevel === classLevel && sectionMatchKey(row.name) === wanted,
    )
    .map((row) => row.id);
  return ids.length > 0 ? ids : undefined;
}

/** One class (optional section) from a full school roster — shared by admin and school drives. */
export function studentsInClass(
  students: Student[],
  classLevel: number,
  section?: string,
  options?: { sectionIds?: string[] },
) {
  const wanted = section ? sectionMatchKey(section) : "";
  return students
    .filter((student) => {
      if (student.classLevel !== classLevel) return false;
      if (!wanted) return true;
      // Prefer section id when the class organization is known (avoids name mismatches).
      if (options?.sectionIds?.length) {
        if (student.sectionId && options.sectionIds.includes(student.sectionId)) return true;
        // Whole-class students (no section row) display as the default section letter.
        if (!student.sectionId && wanted === DEFAULT_SECTION_NAME) return true;
        // Id list missed them — still match by section name (prod naming variants).
        return sectionMatchKey(student.sectionName) === wanted;
      }
      return sectionMatchKey(student.sectionName) === wanted;
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
    const wanted = sectionMatchKey(section);
    return organization.sections
      .filter((row) => row.classLevel === classLevel && sectionMatchKey(row.name) === wanted)
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
