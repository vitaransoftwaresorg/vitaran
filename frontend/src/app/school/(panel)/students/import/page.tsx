import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { verifySchoolSession } from "@/features/school-auth/session";
import { ImportAllStudentsForm } from "@/features/students/import-all-students-form";
import { listSchoolClassOrganization } from "@/services/sections";

export const metadata: Metadata = { title: "Import all students" };

export default async function SchoolStudentsImportPage() {
  const [school, organization] = await Promise.all([
    verifySchoolSession(),
    listSchoolClassOrganization(),
  ]);

  return (
    <>
      <PageHeader title="Import all students" description={school.name} />
      <div className="mt-3">
        <ImportAllStudentsForm
          schoolName={school.name}
          organization={organization}
          returnTo="/school/students"
        />
      </div>
    </>
  );
}
