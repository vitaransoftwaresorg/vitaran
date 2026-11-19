import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHero } from "@/components/shared/page-hero";
import { Reveal } from "@/components/shared/reveal";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
import { PUBLIC_RESULTS_PATH } from "@/features/results/constants";
import { PortalResultsDrive } from "@/features/results/portal-results-drive";
import { PublicSchoolResultsForm } from "@/features/results/public-school-results-form";
import { PublicAccessGuard } from "@/features/settings/public-access-guard";
import { listPublicResultSets } from "@/services/results";
import { getPublicSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Results",
  description: "Enter your School ID to view published test results and ranks.",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PublicResultsPage({
  searchParams,
}: PageProps<"/results">) {
  const { resultsPublic } = await getPublicSettings();
  if (!resultsPublic) {
    redirect(SCHOOL_LOGIN_PATH);
  }

  const query = await searchParams;
  const schoolCode = first(query.school)?.trim() ?? "";

  const lookup = schoolCode ? await listPublicResultSets(schoolCode) : null;
  const school = lookup?.school ?? null;
  const resultSets = lookup?.items ?? [];
  const unknownSchool = Boolean(schoolCode) && !school;

  return (
    <>
      <PublicAccessGuard flag="resultsPublic" />
      <PageHero
        title={
          <>
            Results <span className="text-gradient">&amp; Ranks</span>
          </>
        }
      />
      <section className="py-10 sm:py-12">
        <div className="mx-auto max-w-5xl space-y-6 px-5 sm:px-8">
          {!schoolCode || unknownSchool ? (
            <Reveal>
              <PublicSchoolResultsForm
                initialCode={schoolCode}
                error={unknownSchool ? "No school found for that School ID. Check it and try again." : null}
              />
            </Reveal>
          ) : (
            <>
              <Reveal>
                <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
                      School
                    </p>
                    <h2 className="truncate text-lg font-bold text-neutral-950">{school!.name}</h2>
                    <p className="font-mono text-xs text-neutral-500">ID {school!.code}</p>
                  </div>
                  <Link
                    href={PUBLIC_RESULTS_PATH}
                    className="text-sm font-semibold text-brand-800 hover:underline"
                  >
                    Change school
                  </Link>
                </div>
              </Reveal>
              <Reveal>
                {resultSets.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
                    No published results for this school yet.
                  </div>
                ) : (
                  <Suspense>
                    <PortalResultsDrive
                      resultSets={resultSets}
                      basePath={PUBLIC_RESULTS_PATH}
                      schoolCode={school!.code}
                    />
                  </Suspense>
                )}
              </Reveal>
            </>
          )}
        </div>
      </section>
    </>
  );
}
