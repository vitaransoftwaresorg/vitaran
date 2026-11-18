import { notFound } from "next/navigation";
import { StudentDetailView } from "@/features/students/student-detail-view";
import { getAdminStudent, getAdminStudentPerformance } from "@/services/students";

type Props = { params: Promise<{ studentId: string }> };

function rosterHref(student: {
  schoolId: string;
  classLevel: number;
  sectionName: string | null;
}) {
  return `/admin/schools/students?${new URLSearchParams({
    school: student.schoolId,
    class: String(student.classLevel),
  })}`;
}

export default async function AdminStudentDetailPage({ params }: Props) {
  const { studentId } = await params;
  const [student, performance] = await Promise.all([
    getAdminStudent(studentId),
    getAdminStudentPerformance(studentId).catch(() => []),
  ]);
  if (!student) notFound();

  const listHref = rosterHref(student);

  return (
    <StudentDetailView
      student={student}
      editHref={`/admin/schools/students/${studentId}/edit`}
      afterDeleteHref={listHref}
      backHref={listHref}
      adminFlat
      performance={performance}
      portal="admin"
    />
  );
}
