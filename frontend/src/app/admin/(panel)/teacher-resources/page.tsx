import { PageHeader } from "@/features/admin/page-header";
import { AdminTeacherResourcesBoard } from "@/features/teacher-resources/admin-teacher-resources-board";
import { listAdminRegularTeacherResources } from "@/services/regular-teacher-resources";
import { listCustomizedSchoolOptions } from "@/services/schools";

export default async function AdminTeacherResourcesPage() {
  const [customizedSchools, initialRegular] = await Promise.all([
    listCustomizedSchoolOptions().catch(() => []),
    listAdminRegularTeacherResources().catch(() => []),
  ]);

  return (
    <>
      <PageHeader description="Upload regular solution books into the database, and manage per-school customized teacher PDFs." />
      <AdminTeacherResourcesBoard
        customizedSchools={customizedSchools}
        initialRegular={initialRegular}
      />
    </>
  );
}
