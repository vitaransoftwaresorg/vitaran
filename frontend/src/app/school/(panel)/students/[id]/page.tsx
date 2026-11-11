import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudentDetailView } from "@/features/students/student-detail-view";
import { getSchoolStudent, getSchoolStudentPerformance } from "@/services/students";

export const metadata: Metadata = { title: "Student" };

type Props = { params: Promise<{ id: string }> };

export default async function SchoolStudentDetailPage({ params }: Props) {
  const { id } = await params;
  const [student, performance] = await Promise.all([
    getSchoolStudent(id),
    getSchoolStudentPerformance(id).catch(() => []),
  ]);
  if (!student) notFound();

  return (
    <StudentDetailView
      student={student}
      editHref={`/school/students/${id}/edit`}
      afterDeleteHref="/school/students"
      performance={performance}
      portal="school"
    />
  );
}
