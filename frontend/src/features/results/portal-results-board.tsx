"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/features/admin/page-header";
import { useLiveContent } from "@/features/live/use-live-content";
import type { ResultSet } from "@/types/result";
import {
  loadSchoolPortalResultsAction,
  loadTeacherPortalResultsAction,
} from "./portal-results-action";
import { PortalResultsDrive } from "./portal-results-drive";

type PortalResultsBoardProps = {
  role: "school" | "teacher";
  basePath: string;
  description: string;
};

/** Reloads instantly when admin publishes/hides results — live stream + focus/visibility. */
export function PortalResultsBoard({ role, basePath, description }: PortalResultsBoardProps) {
  const [resultSets, setResultSets] = useState<ResultSet[] | null>(null);

  const reload = useCallback(() => {
    void (async () => {
      const next =
        role === "school"
          ? await loadSchoolPortalResultsAction()
          : await loadTeacherPortalResultsAction();
      setResultSets(next);
    })();
  }, [role]);

  useLiveContent("results", reload);

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

  if (resultSets === null) {
    return (
      <>
        <PageHeader description={description} />
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
          Loading results…
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader count={resultSets.length} description={description} />
      <Suspense>
        <PortalResultsDrive resultSets={resultSets} basePath={basePath} />
      </Suspense>
    </>
  );
}
