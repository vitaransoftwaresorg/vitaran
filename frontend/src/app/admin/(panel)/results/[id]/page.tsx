import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PenLine } from "lucide-react";
import { RESULTS_PATH, resultEnterHref } from "@/features/results/constants";
import { ResultSetView, classScanFilter, selectedClass } from "@/features/results/result-set-view";
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
  if (!resultSet || !sheet) notFound();

  return (
    <ResultSetView
      resultSet={resultSet}
      sheet={sheet}
      scans={scans}
      basePath={RESULTS_PATH}
      showSchool
      actions={
        <Link
          href={resultEnterHref({
            schoolId: resultSet.school.id,
            program: resultSet.program ?? undefined,
            testNumber: resultSet.testNumber,
            classLevel: sheet.classLevel,
          })}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-4 text-sm font-semibold text-brand-900 transition-colors hover:border-brand-300 hover:bg-brand-50"
        >
          <PenLine className="size-4" />
          Enter marks
        </Link>
      }
    />
  );
}
