import { displaySectionName } from "@/features/schools/section-label";
import type { ClassOrganization } from "@/types/section";
import type { BulkStudentRowInput } from "@/types/student";
import type { ImportedStudent } from "./student-excel";

export type ImportPlacement = {
  programId: string;
  programName: string;
  classLevel: number;
  sectionId: string | null;
  sectionLabel: string;
};

export type ResolvedImportRow = {
  index: number;
  student: ImportedStudent;
  placement: ImportPlacement | null;
  error: string | null;
};

export type ImportClassGroup = {
  key: string;
  programId: string;
  programName: string;
  classLevel: number;
  sectionId: string | null;
  sectionLabel: string;
  rows: ResolvedImportRow[];
};

/** Map Class + Section from Excel onto the school's class organization. */
export function resolveImportPlacement(
  organization: ClassOrganization,
  classLevel: number | null,
  sectionName: string,
): { placement: ImportPlacement | null; error: string | null } {
  if (classLevel == null) {
    return { placement: null, error: "Class is required" };
  }

  const classSections = organization.sections.filter(
    (section) => section.classLevel === classLevel,
  );
  const classWholes = organization.wholeClasses.filter(
    (row) => row.classLevel === classLevel,
  );

  if (classSections.length === 0 && classWholes.length === 0) {
    return {
      placement: null,
      error: `Class ${classLevel} is not set up for this school`,
    };
  }

  if (classSections.length > 0) {
    const wanted = sectionName.trim().toUpperCase() || "A";
    const matches = classSections.filter(
      (section) => displaySectionName(section.name).toUpperCase() === wanted,
    );
    if (matches.length === 0) {
      const available = [
        ...new Set(classSections.map((section) => displaySectionName(section.name))),
      ].join(", ");
      return {
        placement: null,
        error: `Section ${wanted} is not set up for Class ${classLevel} (use ${available})`,
      };
    }
    const section = matches[0]!;
    return {
      placement: {
        programId: section.programId,
        programName: section.programName,
        classLevel,
        sectionId: section.id,
        sectionLabel: displaySectionName(section.name),
      },
      error: null,
    };
  }

  // Whole class (no section folders) — Section column is ignored.
  const whole = classWholes[0]!;
  return {
    placement: {
      programId: whole.programId,
      programName: whole.programName,
      classLevel,
      sectionId: null,
      sectionLabel: "A",
    },
    error: null,
  };
}

export function resolveSchoolImportRows(
  organization: ClassOrganization,
  students: ImportedStudent[],
): ResolvedImportRow[] {
  return students.map((student, index) => {
    const { placement, error } = resolveImportPlacement(
      organization,
      student.classLevel,
      student.section,
    );
    return { index, student, placement, error };
  });
}

/** Group resolved rows by program + class + section for bulk create. */
export function groupImportRows(rows: ResolvedImportRow[]): ImportClassGroup[] {
  const groups = new Map<string, ImportClassGroup>();

  for (const row of rows) {
    if (!row.placement || row.error) continue;
    const { placement } = row;
    const key = `${placement.programId}:${placement.classLevel}:${placement.sectionId ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    groups.set(key, {
      key,
      programId: placement.programId,
      programName: placement.programName,
      classLevel: placement.classLevel,
      sectionId: placement.sectionId,
      sectionLabel: placement.sectionLabel,
      rows: [row],
    });
  }

  return [...groups.values()].sort((a, b) => {
    if (a.classLevel !== b.classLevel) return a.classLevel - b.classLevel;
    return a.sectionLabel.localeCompare(b.sectionLabel);
  });
}

export function toBulkRows(rows: ResolvedImportRow[]): BulkStudentRowInput[] {
  return rows.map((row) => ({
    name: row.student.name,
    rollNo: row.student.rollNo,
    parentName: row.student.parentName || null,
    parentPhone: row.student.parentPhone || null,
    email: null,
    sectionId: row.placement?.sectionId ?? null,
  }));
}
