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

/** Prefer a published sheet, then the newest set. */
function pickSetForClass(sets: ResultSet[], classLevel: number): ResultSet | undefined {
  const withClass = sets.filter((set) => set.classes.some((row) => row.classLevel === classLevel));
  if (withClass.length === 0) return undefined;
  return [...withClass].sort((a, b) => {
    const aLive = a.published && a.classes.some((row) => row.classLevel === classLevel && row.published) ? 1 : 0;
    const bLive = b.published && b.classes.some((row) => row.classLevel === classLevel && row.published) ? 1 : 0;
    if (bLive !== aLive) return bLive - aLive;
    return b.updatedAt.localeCompare(a.updatedAt);
  })[0];
}

/** School / teacher results: select a test, then open a class. No program step. */
export function PortalResultsDrive({ resultSets, basePath, schoolCode }: PortalResultsDriveProps) {
  const params = useSearchParams();
  const school = schoolCode?.trim() || params.get("school")?.trim() || "";

  const testNumbers = [
    ...new Set(resultSets.map((set) => set.testNumber).filter((n) => Number.isInteger(n) && n > 0)),
  ].sort((a, b) => b - a);

  const testParam = params.get("test");
  const testAsNumber = Number(testParam);
  // Prefer test number (?test=3). Fall back to a result-set id from older links.
  const openTestNumber =
    Number.isInteger(testAsNumber) && testAsNumber > 0 && testNumbers.includes(testAsNumber)
      ? testAsNumber
      : resultSets.find((set) => set.id === testParam)?.testNumber;

  const openSets =
    openTestNumber != null
      ? resultSets
          .filter((set) => set.testNumber === openTestNumber)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : [];

  const href = (next: { test?: number } = {}) => {
    const query = new URLSearchParams();
    if (school) query.set("school", school);
    if (next.test != null) query.set("test", String(next.test));
    return query.size ? `${basePath}?${query}` : basePath;
  };

  const sheetItem = (set: ResultSet, classLevel: number, name: string): DriveItem => {
    const sheet = set.classes.find((row) => row.classLevel === classLevel)!;
    const view = resultSetHref(basePath, set.id, classLevel, school || undefined);
    const live = sheet.published && set.published;
    return {
      id: `${set.id}:${classLevel}`,
      name,
      kind: "file",
      fileKind: "sheet",
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
  if (openTestNumber != null) {
    breadcrumbs.push({
      label: `Test ${openTestNumber}`,
      href: href({ test: openTestNumber }),
    });
  }

  let items: DriveItem[];
  let emptyText = "Test results for your school will appear here when they are available.";

  if (openTestNumber == null) {
    // Step 1 — pick a test
    items = testNumbers.map((testNumber) => {
      const sets = resultSets.filter((set) => set.testNumber === testNumber);
      const classes = new Set(sets.flatMap((set) => set.classes.map((row) => row.classLevel)));
      const students = sets.reduce(
        (sum, set) => sum + set.classes.reduce((inner, row) => inner + row.rowCount, 0),
        0,
      );
      const anyLive = sets.some((set) => set.published && set.classes.some((row) => row.published));
      const testId = sets.map((set) => set.testId).find((id) => id?.trim()) ?? "";
      return {
        id: `test:${testNumber}`,
        name: `Test ${testNumber}`,
        kind: "folder" as const,
        href: href({ test: testNumber }),
        testId,
        detail: anyLive
          ? `${classes.size} ${classes.size === 1 ? "class" : "classes"} · ${formatNumber(students)} students`
          : `${classes.size} ${classes.size === 1 ? "class" : "classes"} · Not Published`,
        modified: anyLive
          ? formatDateTime(sets[0]!.updatedAt)
          : `Not Published · ${formatDateTime(sets[0]!.updatedAt)}`,
      };
    });
  } else {
    // Step 2 — open a class for that test
    const classLevels = [
      ...new Set(openSets.flatMap((set) => set.classes.map((row) => row.classLevel))),
    ].sort((a, b) => a - b);

    items = classLevels.flatMap((classLevel) => {
      const set = pickSetForClass(openSets, classLevel);
      if (!set) return [];
      const sheet = set.classes.find((row) => row.classLevel === classLevel);
      if (!sheet) return [];
      return [sheetItem(set, classLevel, sheet.label || `Class ${classLevel}`)];
    });
    emptyText = "No classes in this test yet.";
  }

  const searchItems = resultSets.flatMap((set) =>
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
      searchPlaceholder="Search test or class"
    />
  );
}
