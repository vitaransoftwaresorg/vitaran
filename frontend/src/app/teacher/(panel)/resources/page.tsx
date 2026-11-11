import { PortalResourcesBoard } from "@/features/teachers-resources/portal-resources-board";

export default async function TeacherResourcesPage() {
  return (
    <PortalResourcesBoard
      role="teacher"
      description="Solution books for your assigned programs, classes, and subjects."
    />
  );
}
