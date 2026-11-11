"use client";

import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import { PageHeader } from "@/features/admin/page-header";
import { useLiveContent } from "@/features/live/use-live-content";
import { cn } from "@/lib/utils";
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

/** Reloads when admin publishes/hides results — live stream + focus/visibility. */
export function PortalResultsBoard({ role, basePath, description }: PortalResultsBoardProps) {
  const [resultSets, setResultSets] = useState<ResultSet[] | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      const next =
        role === "school"
          ? await loadSchoolPortalResultsAction()
          : await loadTeacherPortalResultsAction();
      setResultSets(next);
    });
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
        <PageHeader title="Results and Ranks" description={description} />
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
          Loading results…
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Results and Ranks" count={resultSets.length} description={description} />
      <div className={cn(pending && "opacity-70 transition-opacity")}>
        <Suspense>
          <PortalResultsDrive resultSets={resultSets} basePath={basePath} />
        </Suspense>
      </div>
    </>
  );
}
