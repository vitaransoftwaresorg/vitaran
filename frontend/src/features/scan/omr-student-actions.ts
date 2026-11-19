"use server";

import { ApiError } from "@/services/api-client";
import type { ScanPortal } from "@/services/scans";
import {
  findStudentIdByRoll,
  getAdminStudent,
  getSchoolStudent,
  getTeacherStudent,
} from "@/services/students";

export type OmrStudentMatch = {
  name: string;
  rollNo: string;
  classLevel: number;
  sectionName: string | null;
  programName: string | null;
};

function cleanRoll(value: string) {
  return value.replace(/\D/g, "").slice(0, 7);
}

/** Look up an enrolled student by registration for the OMR recovery panel. */
export async function lookupOmrStudentByRollAction(
  portal: ScanPortal,
  rollNo: string,
  schoolId?: string,
): Promise<{ ok: true; student: OmrStudentMatch } | { ok: false; message: string }> {
  const roll = cleanRoll(rollNo);
  if (!/^\d{7}$/.test(roll)) {
    return { ok: false, message: "Enter the 7-digit registration number" };
  }
  try {
    if (portal === "school") {
      const id = await findStudentIdByRoll("school", roll);
      if (!id) return { ok: false, message: `No student with registration number ${roll}.` };
      const student = await getSchoolStudent(id);
      if (!student) return { ok: false, message: `No student with registration number ${roll}.` };
      return {
        ok: true,
        student: {
          name: student.name,
          rollNo: student.rollNo,
          classLevel: student.classLevel,
          sectionName: student.sectionName,
          programName: student.programName,
        },
      };
    }
    if (portal === "teacher") {
      const id = await findStudentIdByRoll("teacher", roll);
      if (!id) return { ok: false, message: `No student with registration number ${roll}.` };
      const student = await getTeacherStudent(id);
      if (!student) return { ok: false, message: `No student with registration number ${roll}.` };
      return {
        ok: true,
        student: {
          name: student.name,
          rollNo: student.rollNo,
          classLevel: student.classLevel,
          sectionName: student.sectionName,
          programName: student.programName,
        },
      };
    }
    const id = await findStudentIdByRoll("admin", roll, schoolId);
    if (!id) return { ok: false, message: `No student with registration number ${roll}.` };
    const student = await getAdminStudent(id);
    if (!student) return { ok: false, message: `No student with registration number ${roll}.` };
    return {
      ok: true,
      student: {
        name: student.name,
        rollNo: student.rollNo,
        classLevel: student.classLevel,
        sectionName: student.sectionName,
        programName: student.programName,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : "Could not look up this registration number",
    };
  }
}
