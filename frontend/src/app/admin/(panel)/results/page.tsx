import type { Metadata } from "next";
import { parseListFilters } from "@/features/documents/list-filters";
import {
  deleteResultSheetAction,
  setResultSheetPublishedAction,
} from "@/features/results/actions";
import { ResultsDrive, type DrivePath } from "@/features/results/results-drive";
import { listSchoolTests } from "@/services/answer-keys";
import { listResultSets } from "@/services/results";
import { listAdminPrograms } from "@/services/programs";
import { listSchoolOptions } from "@/services/schools";

export const metadata: Metadata = { title: "Results" };

export default async function AdminResultsPage({ searchParams }: PageProps<"/admin/results">) {
  const [schools, programs] = await Promise.all([listSchoolOptions(), listAdminPrograms()]);
  const filters = parseListFilters(await searchParams, {
    programCodes: programs.map((program) => program.code),
  });
  const [resultSets, schoolTests] = await Promise.all([
    listResultSets({
      testNumber: filters.testNumber,
      type: filters.type,
      schoolId: filters.schoolId,
      limit: 100,
    }),
    filters.schoolId && filters.testNumber
      ? listSchoolTests(filters.schoolId).catch(() => ({ tests: [], classSlots: [] }))
      : Promise.resolve({ tests: [], classSlots: [] }),
  ]);

  const path: DrivePath = {
    schoolId: filters.schoolId,
    testNumber: filters.testNumber,
    // Program is only used when opening a class (enter / upload), not as a drive folder.
    program: filters.program,
  };

  return (
    <ResultsDrive
      resultSets={resultSets}
      programs={programs}
      schools={schools}
      path={path}
      classSlots={schoolTests.classSlots}
      publishAction={setResultSheetPublishedAction}
      deleteAction={deleteResultSheetAction}
    />
  );
}
