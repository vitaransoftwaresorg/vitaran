"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (!setDrivePath) return;
    const href = `/admin/programs/${id}`;
    const crumbs = [{ label: name, href }];
    if (leaf) crumbs.push({ label: leaf, href: `${href}/edit` });
    setDrivePath(crumbs);
    return () => setDrivePath([]);
  }, [id, name, leaf, setDrivePath]);

  return null;
}
