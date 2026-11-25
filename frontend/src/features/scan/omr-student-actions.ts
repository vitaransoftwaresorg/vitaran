"use server";

import { ApiError } from "@/services/api-client";
import type { ScanPortal } from "@/services/scans";
import {
  listAdminSchoolSections,
  listSchoolClassOrganization,
  listTeacherClassOrganization,
} from "@/services/sections";
import {
  findStudentsByRoll,
  getAdminStudent,
  getSchoolStudent,
  getTeacherStudent,
} from "@/services/students";

export type OmrStudentMatch = {
  id: string;
  name: string;
  rollNo: string;
  classLevel: number;
  sectionName: string | null;
  programName: string | null;
  schoolId: string;
  schoolName: string;
};

function cleanRoll(value: string) {
  return value.replace(/\D/g, "").slice(0, 7);
}

function toMatch(
  student: {
    id: string;
    name: string;
    rollNo: string;
    classLevel: number;
    sectionName: string | null;
    programName: string;
    schoolId: string;
    schoolName: string;
  },
): OmrStudentMatch {
  return {
    id: student.id,
    name: student.name,
    rollNo: student.rollNo,
    classLevel: student.classLevel,
    sectionName: student.sectionName,
    programName: student.programName,
    schoolId: student.schoolId,
    schoolName: student.schoolName,
  };
}

export type OmrWalkInSection = { id: string; name: string };

/**
 * Sections for the PDF-majority school + class + program.
 * Empty list → no dropdown (Section A / whole class).
 */
export async function listOmrWalkInSectionsAction(
  portal: ScanPortal,
  schoolId: string,
  classLevel: number,
  programCode: string,
): Promise<{ ok: true; sections: OmrWalkInSection[] } | { ok: false; message: string }> {
  const school = schoolId.trim();
  const program = programCode.trim().toUpperCase();
  if (!school || !program || !Number.isInteger(classLevel) || classLevel < 1) {
    return { ok: true, sections: [] };
  }
  try {
    const org =
      portal === "admin"
        ? await listAdminSchoolSections(school)
        : portal === "teacher"
          ? await listTeacherClassOrganization()
          : await listSchoolClassOrganization();
    const sections = org.sections
      .filter(
        (row) =>
          row.classLevel === classLevel &&
          row.programCode.toUpperCase() === program &&
          (portal !== "admin" || row.schoolId === school),
      )
      .map((row) => ({ id: row.id, name: row.name.trim() || "A" }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return { ok: true, sections };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : "Could not load sections",
    };
  }
}

/** Look up every enrolled student with this registration (all duplicates). */
export async function lookupOmrStudentByRollAction(
  portal: ScanPortal,
  rollNo: string,
  schoolId?: string,
): Promise<
  | { ok: true; students: OmrStudentMatch[] }
  | { ok: false; message: string }
> {
  const roll = cleanRoll(rollNo);
  if (!/^\d{7}$/.test(roll)) {
    return { ok: false, message: "Enter the 7-digit registration number" };
  }
  try {
    const matches = await findStudentsByRoll(portal, roll, schoolId);
    if (matches.length === 0) {
      return { ok: false, message: `No student with registration number ${roll}.` };
    }

    // Teacher portal: only keep students the teacher can open.
    if (portal === "teacher") {
      const visible: OmrStudentMatch[] = [];
      for (const row of matches) {
        const student = await getTeacherStudent(row.id);
        if (student) visible.push(toMatch(student));
      }
      if (visible.length === 0) {
        return { ok: false, message: `No student with registration number ${roll}.` };
      }
      return { ok: true, students: visible };
    }

    if (portal === "school") {
      const visible: OmrStudentMatch[] = [];
      for (const row of matches) {
        const student = await getSchoolStudent(row.id);
        if (student) visible.push(toMatch(student));
      }
      if (visible.length === 0) {
        return { ok: false, message: `No student with registration number ${roll}.` };
      }
      return { ok: true, students: visible };
    }

    const visible: OmrStudentMatch[] = [];
    for (const row of matches) {
      const student = await getAdminStudent(row.id);
      if (student) visible.push(toMatch(student));
    }
    if (visible.length === 0) {
      return { ok: false, message: `No student with registration number ${roll}.` };
    }
    return { ok: true, students: visible };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : "Could not look up this registration number",
    };
  }
}
