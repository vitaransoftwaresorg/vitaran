import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { classWithSectionLabel } from "@/features/schools/section-label";
import type { PerformancePortal } from "@/features/students/performance-actions";
import { StudentPerformance } from "@/features/students/student-performance";
import {
  findStudentIdByRoll,
  getAdminStudent,
  getAdminStudentPerformance,
  getSchoolStudent,
  getSchoolStudentPerformance,
  getTeacherStudent,
  getTeacherStudentPerformance,
} from "@/services/students";
import type { StudentDetail, StudentTestResult } from "@/types/student";

type StudentPerformanceViewProps = {
  role: PerformancePortal;
  rollNo: string;
  classLevel: number;
  section: string | null;
  programKey: string | null;
  schoolId: string;
};

async function loadStudent(
  role: PerformancePortal,
  id: string,
): Promise<StudentDetail | null> {
  if (role === "admin") return getAdminStudent(id);
  if (role === "school") return getSchoolStudent(id);
  return getTeacherStudent(id);
}

async function loadPerformance(
  role: PerformancePortal,
  id: string,
): Promise<StudentTestResult[]> {
  try {
    if (role === "admin") return await getAdminStudentPerformance(id);
    if (role === "school") return await getSchoolStudentPerformance(id);
    return await getTeacherStudentPerformance(id);
  } catch {
    return [];
  }
}

/** Results sheet → student performance by registration number. */
export async function StudentPerformanceView({
  role,
  rollNo,
  classLevel,
  section,
  schoolId,
}: StudentPerformanceViewProps) {
  const id = await findStudentIdByRoll(role, rollNo, role === "admin" ? schoolId : undefined);
  if (!id) notFound();

  const [student, performance] = await Promise.all([
    loadStudent(role, id),
    loadPerformance(role, id),
  ]);
  if (!student) notFound();

  const classLabel = classWithSectionLabel(
    classLevel || student.classLevel,
    section ?? student.sectionName,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={student.name}
        description={`Registration no ${student.rollNo} · ${classLabel}${
          student.programName ? ` · ${student.programName}` : ""
        }`}
      />
      <StudentPerformance results={performance} portal={role} />
    </div>
  );
}
