"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/features/admin/page-header";
import { useLiveContent } from "@/features/live/use-live-content";
import type { AnswerKey } from "@/types/answer-key";
import { PortalAnswerKeysDrive } from "./portal-answer-keys-drive";
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
};

/** Reloads instantly when admin publishes/hides keys — live stream + focus/visibility. */
export function PortalAnswerKeysBoard({
  role,
  basePath,
  programIds,
  programNames,
  ownerLabel,
  description,
}: PortalAnswerKeysBoardProps) {
  const [documents, setDocuments] = useState<AnswerKey[] | null>(null);

  const reload = useCallback(() => {
    void (async () => {
      const next =
        role === "school"
          ? await loadSchoolPortalAnswerKeysAction()
          : await loadTeacherPortalAnswerKeysAction();
      setDocuments(next);
    })();
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
        <PageHeader description={description} />
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
          Loading answer keys…
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader count={documents.length} description={description} />
      <Suspense>
        <PortalAnswerKeysDrive
          programIds={programIds}
          programNames={programNames}
          ownerLabel={ownerLabel}
          documents={documents}
          basePath={basePath}
        />
      </Suspense>
    </>
  );
}
