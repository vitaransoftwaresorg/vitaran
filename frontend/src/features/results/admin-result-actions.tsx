"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { DeleteDocumentButton } from "@/features/documents/delete-document-button";
import { deleteResultSheetAction } from "./actions";
import { RESULTS_PATH, resultEnterHref } from "./constants";

type AdminResultActionsProps = {
  resultSetId: string;
  schoolId: string;
  schoolType?: string;
  program?: string | null;
  testNumber: number;
  classLevel: number;
};

/** Enter marks + delete for the open admin class result. */
export function AdminResultActions({
  resultSetId,
  schoolId,
  schoolType,
  program,
  testNumber,
  classLevel,
}: AdminResultActionsProps) {
  const router = useRouter();
  const backParams = new URLSearchParams({
    school: schoolId,
    test: String(testNumber),
  });
  if (schoolType) backParams.set("type", schoolType);
  const backHref = `${RESULTS_PATH}?${backParams}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={resultEnterHref({
          schoolId,
          program: program ?? undefined,
          testNumber,
          classLevel,
        })}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-4 text-sm font-semibold text-brand-900 transition-colors hover:border-brand-300 hover:bg-brand-50"
      >
        <PenLine className="size-4" />
        Enter marks
      </Link>
      <DeleteDocumentButton
        fileName={`Class ${classLevel} · Test ${testNumber}`}
        noun="class result"
        onDelete={async () => {
          const result = await deleteResultSheetAction(resultSetId, classLevel);
          if (result.ok) router.push(backHref);
          return result;
        }}
      />
    </div>
  );
}
