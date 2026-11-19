"use client";

import { useLayoutEffect, useMemo } from "react";
import { useSetDrivePathCrumbs } from "@/components/layout/drive-path-context";

/** Pushes the program name into the top navbar (Dashboard › Programs › Name). */
export function ProgramNavTrail({
  id,
  name,
  leaf,
}: {
  id: string;
  name: string;
  /** Extra leaf such as Edit. */
  leaf?: string;
}) {
  const setDrivePath = useSetDrivePathCrumbs();
  const crumbs = useMemo(() => {
    const href = `/admin/programs/${id}`;
    const rows = [{ label: name, href }];
    if (leaf) rows.push({ label: leaf, href: `${href}/edit` });
    return rows;
  }, [id, name, leaf]);

  useLayoutEffect(() => {
    if (!setDrivePath) return;
    setDrivePath(crumbs);
    // Do not clear on unmount — Suspense soft-refresh would wipe the top nav.
    // DrivePathProvider clears when leaving /programs/… routes.
  }, [crumbs, setDrivePath]);

  return null;
}
