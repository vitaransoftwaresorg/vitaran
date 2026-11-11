import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { LiveRefresh } from "@/features/live/live-refresh";
import { TEACHER_RESULTS_PATH } from "@/features/results/constants";
import { ResultSetView, classScanFilter, selectedClass } from "@/features/results/result-set-view";
import { listClassScans } from "@/services/scans";
import { getTeacherResultSet, getTeacherResultSheet } from "@/services/results";

export default async function TeacherResultDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ class?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const resultSet = await getTeacherResultSet(id);
  const classLevel = resultSet && selectedClass(resultSet, query.class);
  const [sheet, scans] = classLevel
    ? await Promise.all([
        getTeacherResultSheet(id, classLevel),
        listClassScans("teacher", classScanFilter(resultSet, classLevel)),
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
        basePath={TEACHER_RESULTS_PATH}
        showDownload={false}
      />
    </>
  );
}
