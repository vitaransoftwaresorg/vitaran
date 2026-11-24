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

export type ImportFieldKey =
  | "classLevel"
  | "section"
  | "rollNo"
  | "name"
  | "parentName"
  | "parentPhone";

export type ImportFieldErrors = Partial<Record<ImportFieldKey, string>>;

export type ResolvedImportRow = {
  index: number;
  student: ImportedStudent;
  placement: ImportPlacement | null;
  /** Every field issue on this row (shown together under each cell). */
  fieldErrors: ImportFieldErrors;
  /** Joined summary for filters / counts — null when the row is clean. */
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

function summarizeErrors(fieldErrors: ImportFieldErrors): string | null {
  const messages = Object.values(fieldErrors).filter(Boolean);
  return messages.length > 0 ? messages.join(" · ") : null;
}

/** Map Class + Section from Excel onto the school's class organization. */
export function resolveImportPlacement(
  organization: ClassOrganization,
  classLevel: number | null,
  sectionName: string,
): { placement: ImportPlacement | null; fieldErrors: ImportFieldErrors } {
  const fieldErrors: ImportFieldErrors = {};
  if (classLevel == null) {
    return { placement: null, fieldErrors: { classLevel: "Class is required" } };
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
      fieldErrors: { classLevel: `Class ${classLevel} is not set up for this school` },
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
        fieldErrors: {
          section: `Section ${wanted} is not set up for Class ${classLevel} (use ${available})`,
        },
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
      fieldErrors,
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
    fieldErrors,
  };
}

export function resolveSchoolImportRows(
  organization: ClassOrganization,
  students: ImportedStudent[],
): ResolvedImportRow[] {
  return refreshImportRows(
    organization,
    students.map((student, index) => ({
      index,
      student,
      placement: null,
      fieldErrors: {},
      error: null,
    })),
  );
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
      parentPhone: row.student.parentPhone.replace(/\D/g, "").slice(0, 10),
    };

    const { placement, fieldErrors: placeErrors } = resolveImportPlacement(
      organization,
      student.classLevel,
      student.section,
    );
    const fieldErrors: ImportFieldErrors = { ...placeErrors };

    if (!/^\d{7}$/.test(student.rollNo)) {
      fieldErrors.rollNo = "Reg No must be 7 digits";
    }
    if (student.parentPhone && !/^\d{10}$/.test(student.parentPhone)) {
      fieldErrors.parentPhone = "Enter a 10-digit mobile number";
    }
    if (student.name && student.name.length < 2) {
      fieldErrors.name = "Enter at least 2 characters";
    }
    if (student.parentName && student.parentName.length < 2) {
      fieldErrors.parentName = "Enter at least 2 characters";
    }

    return {
      index,
      student,
      placement,
      fieldErrors,
      error: summarizeErrors(fieldErrors),
    };
  });

  // Flag every duplicate Reg No (not only the later row).
  const byRoll = new Map<string, number[]>();
  for (const row of next) {
    const key = row.student.rollNo;
    if (!/^\d{7}$/.test(key)) continue;
    const list = byRoll.get(key) ?? [];
    list.push(row.index);
    byRoll.set(key, list);
  }
  for (const [, indexes] of byRoll) {
    if (indexes.length < 2) continue;
    for (const index of indexes) {
      const row = next.find((item) => item.index === index);
      if (!row) continue;
      const others = indexes.filter((i) => i !== index).map((i) => i + 1);
      row.fieldErrors.rollNo = `Duplicate Reg No (also on row ${others.join(", ")})`;
      row.error = summarizeErrors(row.fieldErrors);
    }
  }

  return next;
}

/** Merge server/API field errors onto draft rows (does not clear client checks). */
export function mergeImportApiErrors(
  rows: ResolvedImportRow[],
  importRowErrors: Record<number, Record<string, string>> | undefined,
): ResolvedImportRow[] {
  if (!importRowErrors) return rows;
  return rows.map((row) => {
    const api = importRowErrors[row.index];
    if (!api) return row;
    const fieldErrors: ImportFieldErrors = { ...row.fieldErrors };
    for (const [key, message] of Object.entries(api)) {
      if (!message) continue;
      if (
        key === "classLevel" ||
        key === "section" ||
        key === "rollNo" ||
        key === "name" ||
        key === "parentName" ||
        key === "parentPhone" ||
        key === "sectionId"
      ) {
        const mapped = key === "sectionId" ? "section" : (key as ImportFieldKey);
        fieldErrors[mapped] = message;
      }
    }
    return { ...row, fieldErrors, error: summarizeErrors(fieldErrors) };
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
    name: row.student.name.trim(),
    rollNo: row.student.rollNo,
    parentName: row.student.parentName.trim() || null,
    parentPhone: row.student.parentPhone.trim() || null,
    email: null,
    sectionId: row.placement?.sectionId ?? null,
  }));
}
