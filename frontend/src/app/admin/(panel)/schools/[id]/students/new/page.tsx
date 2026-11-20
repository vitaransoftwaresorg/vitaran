import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import {
  addStudentsDescription,
  adminAddStudentsReturnTo,
  resolveAddStudentsPlacement,
} from "@/features/students/add-students-placement";
import { createAdminStudentsBulkAction } from "@/features/students/admin-student-actions";
import { BulkStudentForm } from "@/features/students/bulk-student-form";
import { listAdminSchoolSections } from "@/services/sections";
import { getSchool } from "@/services/schools";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSchoolStudentNewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;

  const [school, organization] = await Promise.all([
    getSchool(id),
    listAdminSchoolSections(id),
  ]);
  if (!school) notFound();

  const placement = resolveAddStudentsPlacement(organization, query);
  const submitAction = createAdminStudentsBulkAction.bind(null, id);

  return (
    <>
      <PageHeader
        title="Add students"
        description={addStudentsDescription(
          school.name,
          placement.classLevel,
          placement.sectionName,
        )}
      />
      <div className="mt-3">
        <BulkStudentForm
          schoolPrograms={school.schoolPrograms}
          sections={organization.sections}
          defaults={placement.defaults}
          lockPlacement={placement.lockPlacement}
          returnTo={adminAddStudentsReturnTo(id, placement.classLevel, placement.sectionName)}
          submitAction={submitAction}
        />
      </div>
    </>
  );
}
