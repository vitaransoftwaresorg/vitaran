import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { parseListFilters } from "@/features/documents/list-filters";
import { setResultPublishedAction } from "@/features/results/actions";
import { ResultsDrive, type DrivePath } from "@/features/results/results-drive";
import { listResultSets } from "@/services/results";
import { listAdminPrograms } from "@/services/programs";
import { listSchoolOptions } from "@/services/schools";

export const metadata: Metadata = { title: "Results" };

export default async function AdminResultsPage({ searchParams }: PageProps<"/admin/results">) {
  const [schools, programs] = await Promise.all([listSchoolOptions(), listAdminPrograms()]);
  const filters = parseListFilters(await searchParams, {
    programCodes: programs.map((program) => program.code),
  });
  const resultSets = await listResultSets({
    testNumber: filters.testNumber,
    type: filters.type,
    schoolId: filters.schoolId,
    limit: 100,
  });

  const path: DrivePath = {
    program: filters.program,
    schoolId: filters.schoolId,
    testNumber: filters.testNumber,
  };

  return (
    <>
      <PageHeader title="Results" />
      <ResultsDrive
        resultSets={resultSets}
        programs={programs}
        schools={schools}
        path={path}
        publishAction={setResultPublishedAction}
      />
    </>
  );
}
