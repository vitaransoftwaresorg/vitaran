import { PortalResourcesBoard } from "@/features/teachers-resources/portal-resources-board";

export default async function SchoolResourcesPage() {
  return (
    <PortalResourcesBoard
      role="school"
      description="Solution books for your enrolled programs, classes, and subjects."
    />
  );
}
