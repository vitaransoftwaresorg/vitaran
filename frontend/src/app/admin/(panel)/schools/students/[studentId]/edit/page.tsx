import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { updateAdminStudentAction } from "@/features/students/admin-student-actions";
import { StudentForm } from "@/features/students/student-form";
import { listAdminSchoolSections } from "@/services/sections";
import { getSchool } from "@/services/schools";
import { getAdminStudent } from "@/services/students";

type Props = { params: Promise<{ studentId: string }> };

export default async function AdminStudentEditPage({ params }: Props) {
  const { studentId } = await params;
  const student = await getAdminStudent(studentId);
  if (!student) notFound();

  const [school, organization] = await Promise.all([
    getSchool(student.schoolId),
    listAdminSchoolSections(student.schoolId),
  ]);
  if (!school) notFound();

  const detailHref = `/admin/schools/students/${studentId}`;
  const formAction = updateAdminStudentAction.bind(null, studentId);

  return (
    <>
      <PageHeader
        title="Edit student"
        description={`${student.name} · Registration no ${student.rollNo} · ${school.name}`}
      />
      <div className="mt-3 w-full max-w-lg rounded-2xl border border-brand-200 bg-white p-4 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)] sm:p-5">
        <StudentForm
          schoolPrograms={school.schoolPrograms}
          sections={organization.sections}
          student={student}
          returnTo={detailHref}
          formActionOverride={formAction}
        />
      </div>
    </>
  );
}
