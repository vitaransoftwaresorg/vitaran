"use client";

import { useLayoutEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useSetDrivePathCrumbs } from "@/components/layout/drive-path-context";
import { rememberAdminNavLabel } from "@/features/admin/nav-labels";

function titleCaseWords(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** Pushes office crumbs: Dashboard › Head Offices › Name Profile [› Edit]. */
export function HeadOfficeNavTrail({ id, name }: { id: string; name: string }) {
  const pathname = usePathname();
  const setDrivePath = useSetDrivePathCrumbs();
  const isEdit = pathname.endsWith("/edit");
  const profileLabel = titleCaseWords(`${name} profile`);

  const crumbs = useMemo(() => {
    const href = `/admin/head-offices/${id}`;
    if (isEdit) {
      return [
        { label: profileLabel, href },
        { label: "Edit", href: `${href}/edit` },
      ];
    }
    return [{ label: profileLabel, href }];
  }, [id, profileLabel, isEdit]);

  useLayoutEffect(() => {
    rememberAdminNavLabel("office", id, name);
    setDrivePath?.(crumbs);
    return () => setDrivePath?.([]);
  }, [id, name, crumbs, setDrivePath]);

  return null;
}
