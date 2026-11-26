import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminResultActions } from "@/features/results/admin-result-actions";
import { RESULTS_PATH } from "@/features/results/constants";
import { safeResultsReturnHref } from "@/features/results/portal-drive-path";
import { PortalResultSetView } from "@/features/results/portal-result-set-view";
import { classScanFilter, selectedClass } from "@/features/results/result-set-view";
import { listClassScans } from "@/services/scans";
import { getResultSet, getResultSheet } from "@/services/results";

export const metadata: Metadata = { title: "Results" };

export default async function ResultPage({ params, searchParams }: PageProps<"/admin/results/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const resultSet = await getResultSet(id);
  const classLevel = resultSet && selectedClass(resultSet, query.class);
  const [sheet, scans] = classLevel
    ? await Promise.all([
        getResultSheet(id, classLevel),
        listClassScans("admin", classScanFilter(resultSet, classLevel)),
      ])
    : [null, []];
  if (!resultSet || !sheet) {
    redirect(safeResultsReturnHref(query.from, RESULTS_PATH));
  }

  // Layout LiveRefresh keeps this page in sync across admin / school / teacher.
  return (
    <PortalResultSetView
      key={`${resultSet.id}:${sheet.classLevel}:${scans.length}`}
      resultSet={resultSet}
      sheet={sheet}
      scans={scans}
      basePath={RESULTS_PATH}
      portal="admin"
      showSchool
      actions={
        <AdminResultActions
          resultSetId={resultSet.id}
          schoolId={resultSet.school.id}
          schoolType={resultSet.school.type}
          program={resultSet.program}
          testNumber={resultSet.testNumber}
          classLevel={sheet.classLevel}
        />
      }
    />
  );
}
