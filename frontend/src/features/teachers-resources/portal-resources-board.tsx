"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/features/admin/page-header";
import { useLiveContent } from "@/features/live/use-live-content";
import {
  loadSchoolPortalResourcesAction,
  loadTeacherPortalResourcesAction,
  type PortalResourcesPayload,
} from "./portal-resources-action";
import { ResourcePage } from "./resource-page";
import { solutionBooks } from "./solution-books";

type PortalResourcesBoardProps = {
  role: "school" | "teacher";
  description: string;
};

/** Reloads offerings/assignments instantly when admin changes classes or programs. */
export function PortalResourcesBoard({ role, description }: PortalResourcesBoardProps) {
  const [payload, setPayload] = useState<PortalResourcesPayload | null>(null);

  const reload = useCallback(() => {
    void (async () => {
      const next =
        role === "school"
          ? await loadSchoolPortalResourcesAction()
          : await loadTeacherPortalResourcesAction();
      setPayload(next);
    })();
  }, [role]);

  useLiveContent("sections", reload);
  useLiveContent("teachers", reload);
  useLiveContent("programs", reload);
  useLiveContent("schools", reload);

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

  if (payload === null) {
    return (
      <>
        <PageHeader description={description} />
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
          Loading resources…
        </div>
      </>
    );
  }

  const cacheKey = payload.assignments
    .map((row) => `${row.programCode}:${row.classLevel}:${row.subject}`)
    .sort()
    .join("|");

  return (
    <>
      <PageHeader description={description} />
      <div className="-mx-4 -mb-4 sm:-mx-5 lg:-mx-6">
        <ResourcePage
          key={cacheKey}
          title="Teachers"
          highlight="Resources"
          books={solutionBooks}
          programIds={payload.programIds}
          catalogIds={payload.catalogIds}
          programNames={payload.programNames}
          subjectIds={payload.subjectIds}
          assignments={payload.assignments}
          label="Solution Books"
          emptyMessage="Solution books for your subjects in this program will be available here soon."
          compact
        />
      </div>
    </>
  );
}
