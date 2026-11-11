import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudentDetailView } from "@/features/students/student-detail-view";
import { getTeacherStudent, getTeacherStudentPerformance } from "@/services/students";

export const metadata: Metadata = { title: "Student" };

export default async function TeacherStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [student, performance] = await Promise.all([
    getTeacherStudent(id),
    getTeacherStudentPerformance(id).catch(() => []),
  ]);
  if (!student) notFound();

  return (
    <StudentDetailView
      student={student}
      showActions={false}
      performance={performance}
      portal="teacher"
    />
  );
}
