import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { verifySchoolSession } from "@/features/school-auth/session";
import { StudentForm } from "@/features/students/student-form";
import { listSchoolClassOrganization } from "@/services/sections";
import { getSchoolStudent } from "@/services/students";

export const metadata: Metadata = { title: "Edit student" };

type Props = { params: Promise<{ id: string }> };

export default async function SchoolStudentEditPage({ params }: Props) {
  const { id } = await params;
  const [school, student, organization] = await Promise.all([
    verifySchoolSession(),
    getSchoolStudent(id),
    listSchoolClassOrganization(),
  ]);
  if (!student) notFound();

  const detailHref = `/school/students/${id}`;

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
        />
      </div>
    </>
  );
}
