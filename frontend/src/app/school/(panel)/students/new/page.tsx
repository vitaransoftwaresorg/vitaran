import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { verifySchoolSession } from "@/features/school-auth/session";
import {
  addStudentsDescription,
  resolveAddStudentsPlacement,
  schoolAddStudentsReturnTo,
} from "@/features/students/add-students-placement";
import { BulkStudentForm } from "@/features/students/bulk-student-form";
import { listSchoolClassOrganization } from "@/services/sections";

export const metadata: Metadata = { title: "Add students" };

export default async function SchoolStudentNewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;

  const [school, organization] = await Promise.all([
    verifySchoolSession(),
    listSchoolClassOrganization(),
  ]);

  const placement = resolveAddStudentsPlacement(organization, query);

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
          returnTo={schoolAddStudentsReturnTo(placement.classLevel, placement.sectionName)}
        />
      </div>
    </>
  );
}
