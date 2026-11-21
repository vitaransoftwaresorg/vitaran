"use client";

import { useSearchParams } from "next/navigation";
import { wasEdited } from "@/features/documents/constants";
import { DriveBrowser, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
import type { ResultSet } from "@/types/result";
import { formatDateTime, formatNumber } from "@/utils/format";
import { resultSetHref, resultSheetDownloadHref, studentCount } from "./constants";

type PortalResultsDriveProps = {
  resultSets: ResultSet[];
  basePath: string;
  /** Keep this School ID in drive links (public results lookup). */
  schoolCode?: string;
};

const testName = (set: ResultSet, sameNumber: boolean) =>
  sameNumber ? `Test ${set.testNumber} · ${set.testId}` : `Test ${set.testNumber}`;

/** School / teacher results and ranks: test → class (no program folder). */
export function PortalResultsDrive({ resultSets, basePath, schoolCode }: PortalResultsDriveProps) {
  const params = useSearchParams();
  const tests = [...resultSets].sort(
    (a, b) => b.testNumber - a.testNumber || b.updatedAt.localeCompare(a.updatedAt),
  );
  const openSet = tests.find((set) => set.id === params.get("test"));
  const school = schoolCode?.trim() || params.get("school")?.trim() || "";

  const href = (next: { test?: string } = {}) => {
    const query = new URLSearchParams();
    if (school) query.set("school", school);
    if (next.test) query.set("test", next.test);
    return query.size ? `${basePath}?${query}` : basePath;
  };

  const repeated = (set: ResultSet) =>
    tests.filter((other) => other.testNumber === set.testNumber).length > 1;

  const sheetItem = (set: ResultSet, classLevel: number, name: string): DriveItem => {
    const sheet = set.classes.find((row) => row.classLevel === classLevel)!;
    const view = resultSetHref(basePath, set.id, classLevel, school || undefined);
    const live = sheet.published && set.published;
    return {
      id: `${set.id}:${classLevel}`,
      name,
      kind: "file",
      fileKind: "sheet",
      // Unpublished sheets are listed but not openable — click shows an alert.
      href: live ? view : undefined,
      blockedMessage: live
        ? undefined
        : "Not Published. This result will open here once the admin publishes it.",
      testId: set.testId,
      detail: live
        ? studentCount(sheet.rowCount)
        : `${studentCount(sheet.rowCount)} · Not Published`,
      modified: live
        ? `${wasEdited({ createdAt: set.createdAt, updatedAt: sheet.updatedAt }) ? "Updated" : "Published"} ${formatDateTime(sheet.updatedAt)}`
        : `Not Published · ${formatDateTime(sheet.updatedAt)}`,
      actions: live
        ? [
            { label: "View results & ranks", href: view, icon: "view" },
            {
              label: "Download sheet",
              href: resultSheetDownloadHref(basePath, set.id, classLevel),
              icon: "download",
              download: true,
            },
          ]
        : [],
    };
  };

  const breadcrumbs: DriveCrumb[] = [{ label: "Results and Ranks", href: basePath }];
  if (openSet) {
    breadcrumbs.push({
      label: testName(openSet, repeated(openSet)),
      href: href({ test: openSet.id }),
    });
  }

  let items: DriveItem[];
  let emptyText = "Test results for your school will appear here when they are available.";

  if (!openSet) {
    items = tests.map((set) => {
      const students = set.classes.reduce((sum, row) => sum + row.rowCount, 0);
      const anyLive = set.published && set.classes.some((row) => row.published);
      return {
        id: `test:${set.id}`,
        name: testName(set, repeated(set)),
        kind: "folder" as const,
        href: href({ test: set.id }),
        testId: set.testId,
        detail: anyLive
          ? `${set.classes.length} ${set.classes.length === 1 ? "class" : "classes"} · ${formatNumber(students)} students`
          : `${set.classes.length} ${set.classes.length === 1 ? "class" : "classes"} · Not Published`,
        modified: anyLive ? formatDateTime(set.updatedAt) : `Not Published · ${formatDateTime(set.updatedAt)}`,
      };
    });
  } else {
    items = [...openSet.classes]
      .sort((a, b) => a.classLevel - b.classLevel)
      .map((row) => sheetItem(openSet, row.classLevel, row.label || `Class ${row.classLevel}`));
    emptyText = "No classes in this test yet.";
  }

  const searchItems = tests.flatMap((set) =>
    set.classes.map((row) =>
      sheetItem(set, row.classLevel, `Test ${set.testNumber} · ${row.label || `Class ${row.classLevel}`}`),
    ),
  );

  return (
    <DriveBrowser
      breadcrumbs={breadcrumbs}
      items={items}
      searchItems={searchItems}
      emptyText={emptyText}
      searchPlaceholder="Search test ID or class"
    />
  );
}
