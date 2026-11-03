"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { PageHeader } from "@/features/admin/page-header";
import { cn } from "@/lib/utils";
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

/** Reloads offerings/assignments so admin class changes show without a hard refresh. */
export function PortalResourcesBoard({ role, description }: PortalResourcesBoardProps) {
  const [payload, setPayload] = useState<PortalResourcesPayload | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      const next =
        role === "school"
          ? await loadSchoolPortalResourcesAction()
          : await loadTeacherPortalResourcesAction();
      setPayload(next);
    });
  }, [role]);

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
        <PageHeader title="Resources" description={description} />
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
      <PageHeader title="Resources" description={description} />
      <div className={cn("-mx-4 -mb-4 sm:-mx-5 lg:-mx-6", pending && "opacity-70 transition-opacity")}>
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
