import { PageHeader } from "@/features/admin/page-header";
import { SchoolStudentResourcesPanel } from "@/features/schools/school-student-resources-panel";
import { verifyTeacherSession } from "@/features/teacher-auth/session";
import { PortalResourcesBoard } from "@/features/teachers-resources/portal-resources-board";
import { loadTeacherPortalResourcesAction } from "@/features/teachers-resources/portal-resources-action";
import { listTeacherPortalStudentResources } from "@/services/school-student-resources";

export default async function TeacherResourcesPage() {
  const teacher = await verifyTeacherSession();
  const isCustomized = (teacher.school.type ?? "REGULAR") === "CUSTOMIZED";

  if (isCustomized) {
    const regularPrograms = teacher.school.schoolPrograms.filter(
      (row) => (row.type ?? "REGULAR") === "REGULAR",
    );
    const regularCodes = new Set(regularPrograms.map((row) => row.programCode));
    const studentResources = (await listTeacherPortalStudentResources().catch(() => [])).filter(
      (row) => regularCodes.has(row.programCode),
    );
    const programNames = Object.fromEntries(
      regularPrograms.map((row) => [row.programCode, row.programName]),
    );
    return (
      <>
        <PageHeader
          title="Teacher resources"
          description="PDFs for your assigned regular catalog programs, classes, and subjects."
        />
        <SchoolStudentResourcesPanel
          resources={studentResources}
          viewBase="/teacher/resources/student"
          programNames={programNames}
        />
      </>
    );
  }

  const initialPayload = await loadTeacherPortalResourcesAction();
  return (
    <PortalResourcesBoard
      role="teacher"
      description="Solution books for your assigned programs, classes, and subjects."
      initialPayload={initialPayload}
    />
  );
}
