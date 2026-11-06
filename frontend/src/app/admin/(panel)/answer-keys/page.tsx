import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { setAnswerKeyPublishedAction } from "@/features/answer-keys/actions";
import { AnswerKeysDrive, type DrivePath } from "@/features/answer-keys/answer-keys-drive";
import { ANSWER_KEYS_PATH } from "@/features/answer-keys/constants";
import { parseListFilters } from "@/features/documents/list-filters";
import { cn } from "@/lib/utils";
import { getOpenObjectionCount, listRecentAnswerKeys } from "@/services/answer-keys";
import { listAdminPrograms } from "@/services/programs";
import { listSchoolOptions } from "@/services/schools";

export const metadata: Metadata = { title: "Answer Keys" };

export default async function AdminAnswerKeysPage({ searchParams }: PageProps<"/admin/answer-keys">) {
  const [schools, programs, openObjections] = await Promise.all([
    listSchoolOptions(),
    listAdminPrograms(),
    getOpenObjectionCount(),
  ]);
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
      <PageHeader
        title="Answer Keys"
        actions={
          <Link
            href={`${ANSWER_KEYS_PATH}/objections`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <MessageSquareWarning className="size-3.5" />
            Objections
            {openObjections.open > 0 ? (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 tabular-nums">
                {openObjections.open}
              </span>
            ) : null}
          </Link>
        }
      />
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
