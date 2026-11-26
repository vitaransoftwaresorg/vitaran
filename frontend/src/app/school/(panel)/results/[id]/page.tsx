import { redirect } from "next/navigation";
import { SCHOOL_RESULTS_PATH } from "@/features/results/constants";
import { safeResultsReturnHref } from "@/features/results/portal-drive-path";
import { PortalResultSetView } from "@/features/results/portal-result-set-view";
import { classScanFilter, selectedClass } from "@/features/results/result-set-view";
import { listClassScans } from "@/services/scans";
import { getSchoolResultSet, getSchoolResultSheet } from "@/services/results";

export default async function SchoolResultDetailPage({
  params,
  searchParams,
}: PageProps<"/school/results/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const resultSet = await getSchoolResultSet(id);
  const classLevel = resultSet && selectedClass(resultSet, query.class);
  const [sheet, scans] = classLevel
    ? await Promise.all([
        getSchoolResultSheet(id, classLevel),
        listClassScans("school", classScanFilter(resultSet, classLevel)),
      ])
    : [null, []];
  // Deleted from admin / unpublished sheet — return to the test folder, not a hard 404.
  if (!resultSet || !sheet) {
    redirect(safeResultsReturnHref(query.from, SCHOOL_RESULTS_PATH));
  }

  if (!resultSet.published || !sheet.published) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-amber-950">Not Published</p>
        <p className="mt-1 text-sm text-amber-800">
          This result is not published yet. It will open here once the admin publishes it.
        </p>
      </div>
    );
  }

  return (
    <PortalResultSetView
      key={`${resultSet.id}:${sheet.classLevel}:${scans.length}`}
      resultSet={resultSet}
      sheet={sheet}
      scans={scans}
      basePath={SCHOOL_RESULTS_PATH}
      portal="school"
    />
  );
}
