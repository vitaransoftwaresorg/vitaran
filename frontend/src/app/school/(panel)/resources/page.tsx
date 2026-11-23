import { PageHeader } from "@/features/admin/page-header";
import { SchoolStudentResourcesPanel } from "@/features/schools/school-student-resources-panel";
import { verifySchoolSession } from "@/features/school-auth/session";
import { PortalResourcesBoard } from "@/features/teachers-resources/portal-resources-board";
import { loadSchoolPortalResourcesAction } from "@/features/teachers-resources/portal-resources-action";
import { listSchoolPortalStudentResources } from "@/services/school-student-resources";

export default async function SchoolResourcesPage() {
  const school = await verifySchoolSession();
  const initialPayload = await loadSchoolPortalResourcesAction();
  const isCustomized = (school.type ?? "REGULAR") === "CUSTOMIZED";
  const studentResources = isCustomized
    ? await listSchoolPortalStudentResources().catch(() => [])
    : [];

  return (
    <>
      <PortalResourcesBoard
        role="school"
        description="Solution books for programs that have at least one class at your school."
        initialPayload={initialPayload}
      />
      {isCustomized ? (
        <section className="mt-8 space-y-3">
          <PageHeader
            title="Student resources"
            description="PDFs uploaded for your customized classes and subjects."
          />
          <SchoolStudentResourcesPanel
            resources={studentResources}
            viewBase="/school/resources/student"
          />
        </section>
      ) : null}
    </>
  );
}
