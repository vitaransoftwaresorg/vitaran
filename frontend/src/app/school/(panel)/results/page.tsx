import { SCHOOL_RESULTS_PATH } from "@/features/results/constants";
import { PortalResultsBoard } from "@/features/results/portal-results-board";

export default async function SchoolResultsPage() {
  return (
    <PortalResultsBoard
      role="school"
      basePath={SCHOOL_RESULTS_PATH}
      description="Published results for your school."
    />
  );
}
