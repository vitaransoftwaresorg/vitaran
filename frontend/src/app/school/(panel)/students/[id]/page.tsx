import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudentDetailView } from "@/features/students/student-detail-view";
import { getSchoolStudent, getSchoolStudentPerformance } from "@/services/students";

export const metadata: Metadata = { title: "Student" };

type Props = { params: Promise<{ id: string }> };

function rosterHref(student: { classLevel: number; sectionName: string | null }) {
  return `/school/students?${new URLSearchParams({
    class: String(student.classLevel),
  })}`;
}

export default async function SchoolStudentDetailPage({ params }: Props) {
  const { id } = await params;
  const [student, performance] = await Promise.all([
    getSchoolStudent(id),
    getSchoolStudentPerformance(id).catch(() => []),
  ]);
  if (!student) notFound();

  const listHref = rosterHref(student);

  return (
    <StudentDetailView
      student={student}
      editHref={`/school/students/${id}/edit`}
      afterDeleteHref={listHref}
      backHref={listHref}
      performance={performance}
      portal="school"
    />
  );
}
