import { PortalResourcesBoard } from "@/features/teachers-resources/portal-resources-board";
import { loadTeacherPortalResourcesAction } from "@/features/teachers-resources/portal-resources-action";

export default async function TeacherResourcesPage() {
  const initialPayload = await loadTeacherPortalResourcesAction();

  return (
    <PortalResourcesBoard
      role="teacher"
      description="Solution books for your assigned programs, classes, and subjects."
      initialPayload={initialPayload}
    />
  );
}
