"use client";

import { useLayoutEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSetDrivePathCrumbs } from "@/components/layout/drive-path-context";
import { rememberAdminNavLabel } from "@/features/admin/nav-labels";

/** Pushes the school name into the top navbar (Dashboard › Schools › Name). */
export function SchoolNavTrail({
  id,
  name,
  leaf,
}: {
  id: string;
  name: string;
  leaf?: string;
}) {
  const searchParams = useSearchParams();
  const setDrivePath = useSetDrivePathCrumbs();
  const fromHeadOffice = searchParams.get("from") === "head-office";
  const officeId = searchParams.get("office");
  const query =
    fromHeadOffice && officeId
      ? `?from=head-office&office=${encodeURIComponent(officeId)}`
      : "";

  const crumbs = useMemo(() => {
    const href = `/admin/schools/${id}${query}`;
    const rows = [{ label: name, href }];
    if (leaf) rows.push({ label: leaf, href: `/admin/schools/${id}/edit${query}` });
    return rows;
  }, [id, name, leaf, query]);

  useLayoutEffect(() => {
    rememberAdminNavLabel("school", id, name);
    setDrivePath?.(crumbs);
    return () => setDrivePath?.([]);
  }, [id, name, crumbs, setDrivePath]);

  return null;
}
