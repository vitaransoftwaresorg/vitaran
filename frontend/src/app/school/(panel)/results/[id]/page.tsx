import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { LiveRefresh } from "@/features/live/live-refresh";
import { SCHOOL_RESULTS_PATH } from "@/features/results/constants";
import { ResultSetView, classScanFilter, selectedClass } from "@/features/results/result-set-view";
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
  if (!resultSet || !sheet) notFound();

  return (
    <>
      <LiveRefresh kind="results" />
      <PageHeader title="Result" />
      <ResultSetView
        resultSet={resultSet}
        sheet={sheet}
        scans={scans}
        basePath={SCHOOL_RESULTS_PATH}
      />
    </>
  );
}
