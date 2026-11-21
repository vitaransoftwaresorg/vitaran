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

/** Re-place and re-check rows after the user edits the import preview (still not saved). */
export function refreshImportRows(
  organization: ClassOrganization,
  rows: ResolvedImportRow[],
): ResolvedImportRow[] {
  const next = rows.map((row, index) => {
    const student = {
      ...row.student,
      name: row.student.name.trim(),
      parentName: row.student.parentName.trim(),
      rollNo: row.student.rollNo.replace(/\D/g, "").slice(0, 7),
      section: row.student.section.trim().toUpperCase(),
    };
    const { placement, error: placeError } = resolveImportPlacement(
      organization,
      student.classLevel,
      student.section,
    );
    let error = placeError;
    if (!error && !/^\d{7}$/.test(student.rollNo)) {
      error = "Reg No must be 7 digits";
    }
    return { index, student, placement, error };
  });

  const seen = new Map<string, number>();
  for (const row of next) {
    const key = row.student.rollNo;
    if (!key || row.error) continue;
    const earlier = seen.get(key);
    if (earlier != null) {
      row.error = `Duplicate Reg No (also on row ${earlier + 1})`;
    } else {
      seen.set(key, row.index);
    }
  }
  return next;
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
    name: row.student.name.trim(),
    rollNo: row.student.rollNo,
    parentName: row.student.parentName.trim() || null,
    parentPhone: row.student.parentPhone.trim() || null,
    email: null,
    sectionId: row.placement?.sectionId ?? null,
  }));
}
