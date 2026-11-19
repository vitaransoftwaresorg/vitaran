"use client";

import { useLayoutEffect, useMemo } from "react";
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
  const setDrivePath = useSetDrivePathCrumbs();
  const crumbs = useMemo(() => {
    const href = `/admin/schools/${id}`;
    const rows = [{ label: name, href }];
    if (leaf) rows.push({ label: leaf, href: `${href}/edit` });
    return rows;
  }, [id, name, leaf]);

  useLayoutEffect(() => {
    rememberAdminNavLabel("school", id, name);
    setDrivePath?.(crumbs);
  }, [id, name, crumbs, setDrivePath]);

  return null;
}
