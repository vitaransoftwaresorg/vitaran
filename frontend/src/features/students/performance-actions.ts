"use server";

import {
  getAdminStudentPerformance,
  getSchoolStudentPerformance,
  getTeacherStudentPerformance,
} from "@/services/students";
import type { StudentTestResult } from "@/types/student";

export type PerformancePortal = "admin" | "school" | "teacher";

export async function loadStudentPerformanceAction(
  portal: PerformancePortal,
  studentId: string,
): Promise<StudentTestResult[]> {
  try {
    if (portal === "admin") return await getAdminStudentPerformance(studentId);
    if (portal === "school") return await getSchoolStudentPerformance(studentId);
    return await getTeacherStudentPerformance(studentId);
  } catch {
    return [];
  }
}
