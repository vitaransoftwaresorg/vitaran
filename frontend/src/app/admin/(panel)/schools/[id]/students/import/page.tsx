import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { importAdminStudentsAllAction } from "@/features/students/admin-student-actions";
import { ImportAllStudentsForm } from "@/features/students/import-all-students-form";
import { listAdminSchoolSections } from "@/services/sections";
import { getSchool } from "@/services/schools";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSchoolStudentsImportPage({ params }: Props) {
  const { id } = await params;
  const [school, organization] = await Promise.all([
    getSchool(id),
    listAdminSchoolSections(id),
  ]);
  if (!school) notFound();

  const returnTo = `/admin/schools/students?school=${encodeURIComponent(id)}`;
  const submitAction = importAdminStudentsAllAction.bind(null, id);

  return (
    <>
      <PageHeader title="Import all students" description={school.name} />
      <div className="mt-3">
        <ImportAllStudentsForm
          schoolName={school.name}
          organization={organization}
          returnTo={returnTo}
          submitAction={submitAction}
        />
      </div>
    </>
  );
}
