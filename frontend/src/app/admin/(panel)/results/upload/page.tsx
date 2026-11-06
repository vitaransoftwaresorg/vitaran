import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { RESULTS_PATH } from "@/features/results/constants";
import { ResultForm } from "@/features/results/result-form";
import { listSchoolOptions } from "@/services/schools";

export const metadata: Metadata = { title: "Import Excel Results" };

export default async function UploadResultPage({ searchParams }: PageProps<"/admin/results/upload">) {
  const [{ schoolId }, schools] = await Promise.all([searchParams, listSchoolOptions()]);
  const fromSchool =
    typeof schoolId === "string" && schools.some(({ id }) => id === schoolId) ? schoolId : undefined;

  return (
    <>
      <PageHeader
        title="Import Excel"
        description="Pick the school and test, then upload Excel sheets for each class."
      />
      <ResultForm schools={schools} defaultSchoolId={fromSchool} backHref={RESULTS_PATH} />
    </>
  );
}
