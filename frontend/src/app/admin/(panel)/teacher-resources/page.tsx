import { PageHeader } from "@/features/admin/page-header";
import { AdminTeacherResourcesBoard } from "@/features/teacher-resources/admin-teacher-resources-board";
import { listHeadOffices } from "@/services/head-offices";
import { listAdminRegularTeacherResources } from "@/services/regular-teacher-resources";
import { listCustomizedSchoolOptions } from "@/services/schools";

export default async function AdminTeacherResourcesPage() {
  const [customizedSchools, headOffices, initialRegular] = await Promise.all([
    listCustomizedSchoolOptions().catch(() => []),
    listHeadOffices().catch(() => []),
    listAdminRegularTeacherResources().catch(() => []),
  ]);

  return (
    <>
      <PageHeader description="Upload regular solution books into the database, and manage customized teacher PDFs by school or head office." />
      <AdminTeacherResourcesBoard
        customizedSchools={customizedSchools}
        headOffices={headOffices}
        initialRegular={initialRegular}
      />
    </>
  );
}
