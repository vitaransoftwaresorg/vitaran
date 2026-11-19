import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
import { PUBLIC_RESULTS_PATH } from "@/features/results/constants";
import { ResultSetView, selectedClass } from "@/features/results/result-set-view";
import { PublicAccessGuard } from "@/features/settings/public-access-guard";
import { getPublicResultSet, getPublicResultSheet } from "@/services/results";
import { getPublicSettings } from "@/services/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Result" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PublicResultDetailPage({
  params,
  searchParams,
}: PageProps<"/results/[id]">) {
  const { resultsPublic } = await getPublicSettings();
  if (!resultsPublic) {
    redirect(SCHOOL_LOGIN_PATH);
  }

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const schoolCode = first(query.school)?.trim() || undefined;
  const resultSet = await getPublicResultSet(id);
  const classLevel = resultSet && selectedClass(resultSet, query.class);
  const sheet = classLevel ? await getPublicResultSheet(id, classLevel) : null;
  if (!resultSet || !sheet) notFound();

  const backHref = schoolCode
    ? `${PUBLIC_RESULTS_PATH}?school=${encodeURIComponent(schoolCode)}`
    : PUBLIC_RESULTS_PATH;

  return (
    <div className="w-full space-y-4 px-4 pt-24 pb-8 sm:px-5 sm:pt-26 lg:px-6">
      <PublicAccessGuard flag="resultsPublic" />
      <Link href={backHref} className="text-sm font-semibold text-brand-800 hover:underline">
        ← Back to results
      </Link>
      {!resultSet.published || !sheet.published ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-amber-950">Not Published</p>
          <p className="mt-1 text-sm text-amber-800">
            This result is not published yet. It will open here once it is published.
          </p>
        </div>
      ) : (
        <ResultSetView
          resultSet={resultSet}
          sheet={sheet}
          scans={[]}
          basePath={PUBLIC_RESULTS_PATH}
          showSchool
          blockUnpublishedClasses
          schoolCode={schoolCode}
        />
      )}
    </div>
  );
}
