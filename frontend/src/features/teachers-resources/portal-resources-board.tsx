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
  /** From the server page — avoid a blank “Loading…” round-trip on open. */
  initialPayload: PortalResourcesPayload;
};

/** Shows server-fetched resources immediately; live events refresh in the background. */
export function PortalResourcesBoard({
  role,
  description,
  initialPayload,
}: PortalResourcesBoardProps) {
  const [payload, setPayload] = useState(initialPayload);

  useEffect(() => {
    setPayload(initialPayload);
  }, [initialPayload]);

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
