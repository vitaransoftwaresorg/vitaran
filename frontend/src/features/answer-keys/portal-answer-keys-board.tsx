"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { PageHeader } from "@/features/admin/page-header";
import { SchoolDocuments } from "@/features/documents/school-documents";
import { useLiveContent } from "@/features/live/use-live-content";
import { cn } from "@/lib/utils";
import type { PdfDocument } from "@/types/document";
import { ANSWER_KEY_NOUN } from "./constants";
import {
  loadSchoolPortalAnswerKeysAction,
  loadTeacherPortalAnswerKeysAction,
} from "./portal-answer-keys-action";

type PortalAnswerKeysBoardProps = {
  role: "school" | "teacher";
  basePath: string;
  programIds: string[];
  programNames?: Record<string, string>;
  /** Customized school — tabs and keys use this name instead of a regular catalog title. */
  ownerLabel?: string;
  description: string;
  hideIdBadgeOnMobile?: boolean;
};

/** Reloads when admin publishes/hides keys — live stream + focus/visibility. */
export function PortalAnswerKeysBoard({
  role,
  basePath,
  programIds,
  programNames,
  ownerLabel,
  description,
  hideIdBadgeOnMobile = false,
}: PortalAnswerKeysBoardProps) {
  const [documents, setDocuments] = useState<PdfDocument[] | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      const next =
        role === "school"
          ? await loadSchoolPortalAnswerKeysAction()
          : await loadTeacherPortalAnswerKeysAction();
      setDocuments(next);
    });
  }, [role]);

  useLiveContent("answer-keys", reload);

  useEffect(() => {
    reload();

    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  if (documents === null) {
    return (
      <>
        <PageHeader title="Answer keys" description={description} />
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
          Loading answer keys…
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Answer keys" count={documents.length} description={description} />
      <div className={cn(pending && "opacity-70 transition-opacity")}>
        <SchoolDocuments
          key={documents.map((doc) => `${doc.id}:${doc.updatedAt}`).join("|")}
          programIds={programIds}
          programNames={programNames}
          ownerLabel={ownerLabel}
          documents={documents}
          noun={ANSWER_KEY_NOUN}
          basePath={basePath}
          hideIdBadgeOnMobile={hideIdBadgeOnMobile}
        />
      </div>
    </>
  );
}
