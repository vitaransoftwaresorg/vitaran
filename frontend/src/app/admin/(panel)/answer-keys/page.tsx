import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { setAnswerKeyPublishedAction } from "@/features/answer-keys/actions";
import { AnswerKeysDrive, type DrivePath } from "@/features/answer-keys/answer-keys-drive";
import { parseListFilters } from "@/features/documents/list-filters";
import { listRecentAnswerKeys } from "@/services/answer-keys";
import { listAdminPrograms } from "@/services/programs";
import { listSchoolOptions } from "@/services/schools";

export const metadata: Metadata = { title: "Answer Keys" };

export default async function AdminAnswerKeysPage({ searchParams }: PageProps<"/admin/answer-keys">) {
  const [schools, programs] = await Promise.all([listSchoolOptions(), listAdminPrograms()]);
  const filters = parseListFilters(await searchParams, {
    programCodes: programs.map((program) => program.code),
  });
  const answerKeys = await listRecentAnswerKeys({
    testNumber: filters.testNumber,
    type: filters.type,
    schoolId: filters.schoolId,
    program: filters.schoolId ? undefined : filters.program,
    limit: 100,
  });

  const path: DrivePath = {
    program: filters.program,
    schoolId: filters.schoolId,
    testNumber: filters.testNumber,
  };

  return (
    <>
      <PageHeader title="Answer Keys" />
      <AnswerKeysDrive
        items={answerKeys}
        programs={programs}
        schools={schools}
        path={path}
        publishAction={setAnswerKeyPublishedAction}
      />
    </>
  );
}
