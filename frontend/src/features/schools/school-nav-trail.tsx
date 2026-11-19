"use client";

import { useEffect } from "react";
import { useSetDrivePathCrumbs } from "@/components/layout/drive-path-context";

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

  useEffect(() => {
    if (!setDrivePath) return;
    const href = `/admin/schools/${id}`;
    const crumbs = [{ label: name, href }];
    if (leaf) crumbs.push({ label: leaf, href: `${href}/edit` });
    setDrivePath(crumbs);
    return () => setDrivePath([]);
  }, [id, name, leaf, setDrivePath]);

  return null;
}
