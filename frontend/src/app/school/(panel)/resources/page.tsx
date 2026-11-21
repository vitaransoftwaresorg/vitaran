import { PortalResourcesBoard } from "@/features/teachers-resources/portal-resources-board";
import { loadSchoolPortalResourcesAction } from "@/features/teachers-resources/portal-resources-action";

export default async function SchoolResourcesPage() {
  const initialPayload = await loadSchoolPortalResourcesAction();

  return (
    <PortalResourcesBoard
      role="school"
      description="Solution books for programs that have at least one class at your school."
      initialPayload={initialPayload}
    />
  );
}
