import { TEACHER_RESULTS_PATH } from "@/features/results/constants";
import { PortalResultsBoard } from "@/features/results/portal-results-board";

export default async function TeacherResultsPage() {
  return (
    <PortalResultsBoard
      role="teacher"
      basePath={TEACHER_RESULTS_PATH}
      description="Class teachers see every subject for their class. Subject teachers see only their subject."
    />
  );
}
