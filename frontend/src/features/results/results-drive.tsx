"use client";

import { useState } from "react";
import { wasEdited } from "@/features/documents/constants";
import { DriveBrowser, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
import { programLabel, TYPE_LABELS } from "@/features/schools/constants";
import type { DeleteResult } from "@/types/document";
import type { LearningProgram } from "@/types/program";
import type { ResultSet } from "@/types/result";
import { formatDateTime, formatNumber } from "@/utils/format";
import { RESULTS_PATH, resultEditHref, resultEnterHref, resultSetHref } from "./constants";
import { DRIVE_TESTS, type DrivePath, type DriveSchool } from "./drive-path";
import { ResultUploadSheet } from "./result-upload-sheet";
import { isRegularProgramCode, resultOfferingsForSchool } from "./school-program";

export type { DrivePath, DriveSchool } from "./drive-path";

type ResultsDriveProps = {
  resultSets: ResultSet[];
  programs: LearningProgram[];
  schools: DriveSchool[];
  path: DrivePath;
  publishAction: (id: string, published: boolean) => Promise<DeleteResult>;
};

type ClassEntry = {
  classLevel: number;
  program?: string;
  programTitle: string;
};

function hrefFor(path: DrivePath, schoolType?: DriveSchool["type"]) {
  const params = new URLSearchParams();
  if (schoolType) params.set("type", schoolType);
  if (path.schoolId) params.set("school", path.schoolId);
  if (path.testNumber) params.set("test", String(path.testNumber));
  if (path.program) params.set("program", path.program);
  const q = params.toString();
  return q ? `${RESULTS_PATH}?${q}` : RESULTS_PATH;
}

function findResultSet(resultSets: ResultSet[], path: DrivePath) {
  if (!path.schoolId || path.testNumber === undefined) return undefined;
  const matches = resultSets.filter(
    (item) => item.school.id === path.schoolId && item.testNumber === path.testNumber,
  );
  if (path.program) {
    return matches.find((item) => item.program === path.program) ?? matches[0];
  }
  return matches[0];
}

function classEntriesForSchool(
  school: DriveSchool | undefined,
  resultSets: ResultSet[],
  programs: LearningProgram[],
  testNumber: number,
): ClassEntry[] {
  const entries: ClassEntry[] = [];
  const seen = new Set<string>();

  const push = (classLevel: number, program: string | undefined, programTitle: string) => {
    const key = `${program ?? ""}:${classLevel}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ classLevel, program, programTitle });
  };

  const offerings = resultOfferingsForSchool(school, programs);
  for (const offering of offerings) {
    const title = programLabel(offering.code, offering.name);
    for (const classLevel of offering.classLevels) {
      push(classLevel, offering.code, title);
    }
  }

  for (const set of resultSets.filter(
    (item) => item.school.id === school?.id && item.testNumber === testNumber,
  )) {
    // Customized schools must not surface result sets tied to a regular catalog program.
    if (school?.type === "CUSTOMIZED" && isRegularProgramCode(set.program ?? undefined, programs)) {
      continue;
    }
    const title = programLabel(
      set.program ?? "",
      set.programName ?? programs.find((program) => program.code === set.program)?.name,
    );
    for (const sheet of set.classes) {
      push(sheet.classLevel, set.program ?? undefined, title || "Program");
    }
  }

  if (entries.length === 0 && school?.programs?.length) {
    const codes =
      school.type === "CUSTOMIZED"
        ? school.programs.filter((code) => !isRegularProgramCode(code, programs))
        : school.programs;
    for (const code of codes) {
      const catalog = programs.find((program) => program.code === code);
      const title = programLabel(code, school.programLabels?.[code] ?? catalog?.name);
      const from = catalog?.classFrom ?? 1;
      const to = catalog?.classTo ?? 12;
      for (let classLevel = from; classLevel <= to; classLevel += 1) {
        push(classLevel, code, title);
      }
    }
  }

  return entries.sort(
    (a, b) => a.classLevel - b.classLevel || a.programTitle.localeCompare(b.programTitle),
  );
}

export function ResultsDrive({
  resultSets,
  programs,
  schools,
  path,
  publishAction,
}: ResultsDriveProps) {
  const [uploadPath, setUploadPath] = useState<DrivePath | null>(null);

  const schoolId = path.schoolId;
  const currentSchool = schools.find((school) => school.id === schoolId);
  const link = (next: DrivePath, type?: DriveSchool["type"]) =>
    hrefFor(next, type ?? currentSchool?.type ?? schools.find((s) => s.id === next.schoolId)?.type);
  const drivePath: DrivePath = { ...path, schoolId };

  const activeSet = findResultSet(resultSets, drivePath);

  const breadcrumbs: DriveCrumb[] = [{ label: "Results", href: RESULTS_PATH }];
  if (schoolId) {
    breadcrumbs.push({
      label: currentSchool?.name ?? "School",
      href: link({ schoolId }),
    });
  }
  if (schoolId && path.testNumber !== undefined) {
    breadcrumbs.push({
      label: `Test ${path.testNumber}`,
      href: link({ schoolId, testNumber: path.testNumber }),
    });
  }

  const atRoot = !schoolId;
  const inSchool = Boolean(schoolId);
  const inTest = inSchool && path.testNumber !== undefined;

  const openUpload = (classLevel: number, program?: string) => {
    setUploadPath({ ...drivePath, classLevel, program });
  };

  const driveItems: DriveItem[] = [];

  if (atRoot) {
    driveItems.push(
      ...[...schools]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((school) => ({
          id: school.id,
          name: school.name,
          kind: "folder" as const,
          href: link({ schoolId: school.id }, school.type),
          detail: TYPE_LABELS[school.type],
        })),
    );
  } else if (inSchool && !inTest) {
    driveItems.push(
      ...DRIVE_TESTS.map((testNumber) => {
        const count = resultSets
          .filter((item) => item.school.id === schoolId && item.testNumber === testNumber)
          .reduce((total, item) => total + item.classes.length, 0);
        return {
          id: String(testNumber),
          name: `Test ${testNumber}`,
          kind: "folder" as const,
          href: link({ schoolId, testNumber }),
          detail: count > 0 ? `${count} uploaded` : "Empty",
        };
      }),
    );
  } else if (inTest && schoolId && path.testNumber !== undefined) {
    const testNumber = path.testNumber;
    const entries = classEntriesForSchool(currentSchool, resultSets, programs, testNumber);

    driveItems.push(
      ...entries.map((entry) => {
        const entryPath: DrivePath = {
          schoolId,
          testNumber,
          classLevel: entry.classLevel,
          program: entry.program,
        };
        const resultSet = findResultSet(resultSets, entryPath);
        const sheet = resultSet?.classes.find((item) => item.classLevel === entry.classLevel);
        const enterHref = resultEnterHref({
          schoolId,
          program: entry.program,
          testNumber,
          classLevel: entry.classLevel,
        });

        if (!sheet || !resultSet) {
          return {
            id: `class:${entry.program ?? "none"}:${entry.classLevel}`,
            name: `Class ${entry.classLevel}`,
            kind: "folder" as const,
            href: enterHref,
            detail: entry.programTitle,
          };
        }

        const viewHref = resultSetHref(RESULTS_PATH, resultSet.id, entry.classLevel);
        const editHref = resultEditHref(resultSet.id);
        return {
          id: `${resultSet.id}:${entry.classLevel}`,
          name: `Class ${entry.classLevel}`,
          kind: "file" as const,
          fileKind: "sheet" as const,
          href: enterHref,
          detail: `${entry.programTitle} · ${
            resultSet.published
              ? `${formatNumber(sheet.rowCount)} students · Published`
              : `${formatNumber(sheet.rowCount)} students · Hidden`
          }`,
          modified: wasEdited({ createdAt: resultSet.createdAt, updatedAt: sheet.updatedAt })
            ? formatDateTime(sheet.updatedAt)
            : undefined,
          published: resultSet.published,
          publishLabel: `Test ${resultSet.testNumber}`,
          onPublish: publishAction.bind(null, resultSet.id),
          actions: [
            { label: "Enter marks", href: enterHref, icon: "edit" as const },
            { label: "View", href: viewHref, icon: "view" as const },
            { label: "Update", href: editHref, icon: "edit" as const },
            {
              label: "Replace file",
              onSelect: () => openUpload(entry.classLevel, entry.program),
              icon: "upload" as const,
            },
          ],
        };
      }),
    );
  }

  const emptyText = atRoot
    ? "No schools yet"
    : inTest
      ? "No classes for this school"
      : "No tests yet";

  return (
    <>
      <ResultUploadSheet
        open={uploadPath !== null}
        onOpenChange={(open) => {
          if (!open) setUploadPath(null);
        }}
        path={uploadPath ?? drivePath}
        schools={schools}
        programs={programs}
        resultSet={
          uploadPath
            ? findResultSet(resultSets, uploadPath)
            : activeSet
        }
      />
      <DriveBrowser
        breadcrumbs={breadcrumbs}
        items={driveItems}
        emptyText={emptyText}
        searchPlaceholder="Search in this folder"
      />
    </>
  );
}
