"use client";

import { useState } from "react";
import { wasEdited } from "@/features/documents/constants";
import { DriveBrowser, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
import {
  classLevelsForOwner,
  programLabel,
  soleSchoolForCustomProgram,
  unmatchedCustomizedSchools,
  TYPE_LABELS,
} from "@/features/schools/constants";
import type { DeleteResult } from "@/types/document";
import type { LearningProgram } from "@/types/program";
import type { ResultSet } from "@/types/result";
import { formatDateTime, formatNumber } from "@/utils/format";
import { RESULTS_PATH, resultEditHref, resultSetHref } from "./constants";
import { DRIVE_TESTS, type DrivePath, type DriveSchool } from "./drive-path";
import { ResultUploadSheet } from "./result-upload-sheet";

export type { DrivePath, DriveSchool } from "./drive-path";

type ResultsDriveProps = {
  resultSets: ResultSet[];
  programs: LearningProgram[];
  schools: DriveSchool[];
  path: DrivePath;
  publishAction: (id: string, published: boolean) => Promise<DeleteResult>;
};

function hrefFor(path: DrivePath, programs: LearningProgram[] = []) {
  const params = new URLSearchParams();
  const programType = programs.find((program) => program.code === path.program)?.type;
  const type = programType ?? (path.schoolId ? "CUSTOMIZED" : path.program ? "REGULAR" : undefined);
  if (type) params.set("type", type);
  if (path.program) params.set("program", path.program);
  if (path.schoolId) params.set("school", path.schoolId);
  if (path.testNumber) params.set("test", String(path.testNumber));
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

export function ResultsDrive({
  resultSets,
  programs,
  schools,
  path,
  publishAction,
}: ResultsDriveProps) {
  const [uploadPath, setUploadPath] = useState<DrivePath | null>(null);

  const customizedOnly = schools.filter((school) => school.type === "CUSTOMIZED");
  const selectedProgram = programs.find((program) => program.code === path.program);
  const wantedSchoolType = selectedProgram?.type ?? "REGULAR";
  const soleSchool = soleSchoolForCustomProgram(selectedProgram, customizedOnly);
  const schoolId = path.schoolId ?? soleSchool?.id;
  const programName = (code: string) =>
    programLabel(code, programs.find((program) => program.code === code)?.name);
  const link = (next: DrivePath) => hrefFor(next, programs);
  const drivePath: DrivePath = { ...path, schoolId };

  const currentSchool =
    schools.find((school) => school.id === schoolId) ??
    resultSets.find((item) => item.school.id === schoolId)?.school;

  const activeSet = findResultSet(resultSets, drivePath);

  const schoolForFolder = schools.find((school) => school.id === schoolId);
  const breadcrumbs: DriveCrumb[] = [{ label: "Results", href: RESULTS_PATH }];
  if (path.program) {
    breadcrumbs.push({
      label:
        selectedProgram?.type === "CUSTOMIZED"
          ? programName(path.program)
          : schoolForFolder?.type === "CUSTOMIZED"
            ? (schoolForFolder.name ?? programName(path.program))
            : programName(path.program),
      href: link({ program: path.program, schoolId: soleSchool?.id }),
    });
  }
  if (schoolId && schoolId !== soleSchool?.id) {
    breadcrumbs.push({
      label: currentSchool?.name ?? "School",
      href: link({ program: path.program, schoolId }),
    });
  }
  if (path.testNumber) {
    breadcrumbs.push({
      label: `Test ${path.testNumber}`,
      href: link({
        program: path.program,
        schoolId,
        testNumber: path.testNumber,
      }),
    });
  }

  const atRoot = !path.program && !path.schoolId;
  const inProgramOnly = Boolean(path.program && !schoolId);
  const inSchool = Boolean(schoolId);
  const inTest = inSchool && path.testNumber !== undefined;

  const openUpload = (classLevel: number) => {
    setUploadPath({ ...drivePath, classLevel });
  };

  const driveItems: DriveItem[] = [];

  if (atRoot) {
    driveItems.push(
      ...[...programs]
        .sort((a, b) => (a.type === "CUSTOMIZED" ? 1 : 0) - (b.type === "CUSTOMIZED" ? 1 : 0))
        .map((program) => ({
          id: `program:${program.code}`,
          name: programLabel(program.code, program.name),
          kind: "folder" as const,
          href: link({
            program: program.code,
            schoolId: soleSchoolForCustomProgram(program, customizedOnly)?.id,
          }),
          detail: TYPE_LABELS[program.type ?? "REGULAR"],
        })),
      ...unmatchedCustomizedSchools(programs, customizedOnly).map((school) => ({
        id: `school:${school.id}`,
        name: school.name,
        kind: "folder" as const,
        href: link({ schoolId: school.id }),
        detail: TYPE_LABELS.CUSTOMIZED,
      })),
    );
  } else if (inProgramOnly) {
    driveItems.push(
      ...schools
        .filter((school) => school.type === wantedSchoolType && school.programs?.includes(path.program!))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((school) => ({
          id: school.id,
          name: school.name,
          kind: "folder" as const,
          href: link({ program: path.program, schoolId: school.id }),
          detail: school.code,
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
          href: link({ program: path.program, schoolId, testNumber }),
          detail: count > 0 ? `${count} uploaded` : "Empty",
        };
      }),
    );
  } else if (inTest) {
    driveItems.push(
      ...classLevelsForOwner(
        drivePath,
        programs,
        schools,
        activeSet?.classes.map((sheet) => sheet.classLevel) ?? [],
      ).map((classLevel) => {
        const sheet = activeSet?.classes.find((item) => item.classLevel === classLevel);
        if (!sheet || !activeSet) {
          return {
            id: `class:${classLevel}`,
            name: `Class ${classLevel}`,
            kind: "empty" as const,
            detail: "No file yet",
            createLabel: "Upload",
            onCreate: () => openUpload(classLevel),
          };
        }

        const viewHref = resultSetHref(RESULTS_PATH, activeSet.id, classLevel);
        const editHref = resultEditHref(activeSet.id);
        return {
          id: `${activeSet.id}:${classLevel}`,
          name: `Class ${classLevel}`,
          kind: "file" as const,
          fileKind: "sheet" as const,
          href: viewHref,
          detail: activeSet.published
            ? `${formatNumber(sheet.rowCount)} students · Published`
            : `${formatNumber(sheet.rowCount)} students · Hidden`,
          modified: wasEdited({ createdAt: activeSet.createdAt, updatedAt: sheet.updatedAt })
            ? formatDateTime(sheet.updatedAt)
            : undefined,
          published: activeSet.published,
          publishLabel: `Test ${activeSet.testNumber}`,
          onPublish: publishAction.bind(null, activeSet.id),
          actions: [
            { label: "View", href: viewHref, icon: "view" as const },
            { label: "Update", href: editHref, icon: "edit" as const },
            { label: "Replace file", onSelect: () => openUpload(classLevel), icon: "upload" as const },
          ],
        };
      }),
    );
  }

  const emptyText = inProgramOnly
    ? "No schools in this program"
    : inTest
      ? "No classes in this test"
      : "No programs yet";

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
        resultSet={activeSet}
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
