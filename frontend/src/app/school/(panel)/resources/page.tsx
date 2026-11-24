import { PageHeader } from "@/features/admin/page-header";
import { SchoolStudentResourcesPanel } from "@/features/schools/school-student-resources-panel";
import { verifySchoolSession } from "@/features/school-auth/session";
import { PortalResourcesBoard } from "@/features/teachers-resources/portal-resources-board";
import { loadSchoolPortalResourcesAction } from "@/features/teachers-resources/portal-resources-action";
import { listSchoolPortalStudentResources } from "@/services/school-student-resources";

export default async function SchoolResourcesPage() {
  const school = await verifySchoolSession();
  const isCustomized = (school.type ?? "REGULAR") === "CUSTOMIZED";

  if (isCustomized) {
    const regularPrograms = school.schoolPrograms.filter(
      (row) => (row.type ?? "REGULAR") === "REGULAR",
    );
    const regularCodes = new Set(regularPrograms.map((row) => row.programCode));
    const studentResources = (await listSchoolPortalStudentResources().catch(() => [])).filter(
      (row) => regularCodes.has(row.programCode),
    );
    const programNames = Object.fromEntries(
      regularPrograms.map((row) => [row.programCode, row.programName]),
    );
    return (
      <>
        <PageHeader
          title="Teacher resources"
          description="PDFs for your school's regular catalog programs. Register at least one class to see them here."
        />
        <SchoolStudentResourcesPanel
          resources={studentResources}
          viewBase="/school/resources/student"
          programNames={programNames}
        />
      </>
    );
  }

  const initialPayload = await loadSchoolPortalResourcesAction();
  return (
    <PortalResourcesBoard
      role="school"
      description="Solution books for programs that have at least one class at your school."
      initialPayload={initialPayload}
    />
  );
}
