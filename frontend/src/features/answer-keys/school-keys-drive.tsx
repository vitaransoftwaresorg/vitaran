"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DriveBrowser, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
import { documentAnswersHref } from "@/features/documents/constants";
import { displaySectionName } from "@/features/schools/section-label";
import { programLabel } from "@/features/schools/constants";
import type { AnswerKey } from "@/types/answer-key";
import type { ClassOrganization } from "@/types/section";
import type { SchoolOption } from "@/types/school";
import { rememberAdminNavLabel } from "@/features/admin/nav-labels";
import { ensureSchoolSectionKeyAction } from "./actions";
import { SCHOOL_KEYS_PATH } from "./constants";
import { DRIVE_TESTS, writeAnswerKeysFolderTrail } from "./drive-path";

export type SchoolKeyBoardItem = {
  platform: AnswerKey;
  schoolKey: AnswerKey | null;
};

export type SchoolKeyBoard = {
  school: { id: string; name: string; code: string };
  sectionId: string | null;
  sectionName: string | null;
  classLevel: number;
  programCode: string;
  items: SchoolKeyBoardItem[];
};

type SchoolKeysDriveProps = {
  schools: SchoolOption[];
  schoolId?: string;
  programCode?: string;
  testNumber?: number;
  organization?: ClassOrganization | null;
  /** Boards keyed by section id, or `class:{level}` for whole-class. */
  boardsByScope?: Record<string, SchoolKeyBoard>;
};

function schoolHref(schoolId: string) {
  return `${SCHOOL_KEYS_PATH}?${new URLSearchParams({ school: schoolId })}`;
}

function programHref(schoolId: string, program: string) {
  return `${SCHOOL_KEYS_PATH}?${new URLSearchParams({
    school: schoolId,
    program,
  })}`;
}

function testHref(schoolId: string, program: string, testNumber: number) {
  return `${SCHOOL_KEYS_PATH}?${new URLSearchParams({
    school: schoolId,
    program,
    test: String(testNumber),
  })}`;
}

function offeringLabel(school: SchoolOption, code: string) {
  return (
    school.programLabels[code] ||
    school.offerings.find((item) => item.code === code)?.name ||
    programLabel(code)
  );
}

export function SchoolKeysDrive({
  schools,
  schoolId,
  programCode,
  testNumber,
  organization,
  boardsByScope = {},
}: SchoolKeysDriveProps) {
  const router = useRouter();
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [, startCreating] = useTransition();

  const school = schools.find((item) => item.id === schoolId);

  const folderCrumbs: DriveCrumb[] = [];
  if (schoolId && school) {
    folderCrumbs.push({ label: school.name, href: schoolHref(school.id) });
  }
  if (schoolId && school && programCode) {
    folderCrumbs.push({
      label: offeringLabel(school, programCode),
      href: programHref(school.id, programCode),
    });
  }
  if (schoolId && school && programCode && testNumber != null) {
    folderCrumbs.push({
      label: `Test ${testNumber}`,
      href: testHref(school.id, programCode, testNumber),
    });
  }

  useEffect(() => {
    if (school) rememberAdminNavLabel("school", school.id, school.name);
    writeAnswerKeysFolderTrail(
      `${window.location.pathname}${window.location.search}`,
      folderCrumbs,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, school?.id, school?.name, programCode, testNumber]);

  const openSchoolKey = (
    platformKeyId: string,
    targetSectionId: string | null,
    createKey: string,
    from: string,
  ) => {
    if (!schoolId) return;
    setCreatingId(createKey);
    startCreating(async () => {
      const result = await ensureSchoolSectionKeyAction({
        platformKeyId,
        schoolId,
        sectionId: targetSectionId,
      });
      setCreatingId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.push(documentAnswersHref(SCHOOL_KEYS_PATH, result.id, from));
    });
  };

  // School → pick program
  if (schoolId && school && !programCode) {
    const programs =
      school.offerings.length > 0
        ? school.offerings.map((item) => ({
            code: item.code,
            name: item.name || offeringLabel(school, item.code),
            detail: item.classLevels.length
              ? `Classes ${item.classLevels.join(", ")}`
              : "Programs",
          }))
        : school.programs.map((code) => ({
            code,
            name: offeringLabel(school, code),
            detail: "Programs",
          }));

    return (
      <DriveBrowser
        key={`school-keys:${school.id}`}
        breadcrumbs={[{ label: "School Keys", href: SCHOOL_KEYS_PATH }, ...folderCrumbs]}
        items={programs
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({
            id: item.code,
            name: item.name,
            kind: "folder" as const,
            href: programHref(school.id, item.code),
            detail: item.detail,
          }))}
        emptyText="No programs enrolled for this school."
        searchPlaceholder="Search programs"
      />
    );
  }

  // School → program → pick test (before class)
  if (schoolId && school && programCode && testNumber === undefined) {
    return (
      <DriveBrowser
        key={`school-keys:${school.id}:program:${programCode}`}
        breadcrumbs={[{ label: "School Keys", href: SCHOOL_KEYS_PATH }, ...folderCrumbs]}
        items={DRIVE_TESTS.map((number) => ({
          id: String(number),
          name: `Test ${number}`,
          kind: "folder" as const,
          href: testHref(school.id, programCode, number),
          detail: "Classes & sections",
        }))}
        emptyText="No tests yet."
        searchPlaceholder="Search tests"
      />
    );
  }

  // School → program → test → classes & sections
  if (schoolId && school && programCode && testNumber != null && organization) {
    const from = testHref(school.id, programCode, testNumber);
    const programName = offeringLabel(school, programCode);

    const sections = organization.sections.filter((section) => {
      const code = (section.programCode || "").trim().toUpperCase();
      return code === programCode.toUpperCase();
    });
    const sectionLevels = new Set(sections.map((section) => section.classLevel));
    const wholeClasses = organization.wholeClasses.filter((row) => {
      if (sectionLevels.has(row.classLevel)) return false;
      const code = (row.programCode || "").trim().toUpperCase();
      return code === programCode.toUpperCase();
    });

    const sectionItems: DriveItem[] = sections.map((section) => {
      const board = boardsByScope[section.id];
      const row = board?.items.find((item) => item.platform.testNumber === testNumber);
      const label = `Class ${section.classLevel}-${displaySectionName(section.name)}`;
      const createKey = `${section.id}:${testNumber}`;

      if (!row?.platform) {
        return {
          id: section.id,
          name: label,
          kind: "empty" as const,
          detail: "No platform key — add under Answer Keys first",
          createLabel: "Unavailable",
          creating: false,
          onCreate: () => {
            toast.error(
              `Add a platform answer key for ${programName} Class ${section.classLevel}, or change this section’s program under Classes & sections.`,
            );
          },
        };
      }

      const filled = row.schoolKey?.answerCount ?? 0;
      const href = row.schoolKey
        ? documentAnswersHref(SCHOOL_KEYS_PATH, row.schoolKey.id, from)
        : undefined;

      if (!row.schoolKey || filled === 0) {
        return {
          id: section.id,
          name: label,
          kind: "empty" as const,
          detail: row.schoolKey
            ? "Draft school key — save answers to keep"
            : `Using our key · ${row.platform.testId || "no test ID"}`,
          createLabel: row.schoolKey ? "Continue" : "Add school key",
          creating: creatingId === createKey,
          testId: row.platform.testId || "",
          onCreate: () => {
            if (href) {
              router.push(href);
              return;
            }
            openSchoolKey(row.platform.id, section.id, createKey, from);
          },
        };
      }

      return {
        id: section.id,
        name: label,
        kind: "file" as const,
        href,
        detail: `School key · ${row.schoolKey.testId || row.platform.testId}`,
        testId: row.schoolKey.testId || row.platform.testId || "",
        modified: row.schoolKey.updatedAt,
        actions: [
          { label: "Edit answers", href, icon: "edit" as const },
          { label: "View", href, icon: "view" as const },
        ],
      };
    });

    const classItems: DriveItem[] = wholeClasses.map((row) => {
      const board = boardsByScope[`class:${row.classLevel}`];
      const keyRow = board?.items.find((item) => item.platform.testNumber === testNumber);
      const label = `Class ${row.classLevel}`;
      const createKey = `class:${row.classLevel}:${testNumber}`;

      if (!keyRow?.platform) {
        return {
          id: row.id,
          name: label,
          kind: "empty" as const,
          detail: "No platform key — add under Answer Keys first",
          createLabel: "Unavailable",
          creating: false,
          onCreate: () => {
            toast.error("Add a platform answer key for this class under Answer Keys first.");
          },
        };
      }

      const filled = keyRow.schoolKey?.answerCount ?? 0;
      const href = keyRow.schoolKey
        ? documentAnswersHref(SCHOOL_KEYS_PATH, keyRow.schoolKey.id, from)
        : undefined;

      if (!keyRow.schoolKey || filled === 0) {
        return {
          id: row.id,
          name: label,
          kind: "empty" as const,
          detail: keyRow.schoolKey
            ? "Draft school key — save answers to keep"
            : `Using our key · ${keyRow.platform.testId || "no test ID"}`,
          createLabel: keyRow.schoolKey ? "Continue" : "Add school key",
          creating: creatingId === createKey,
          testId: keyRow.platform.testId || "",
          onCreate: () => {
            if (href) {
              router.push(href);
              return;
            }
            openSchoolKey(keyRow.platform.id, null, createKey, from);
          },
        };
      }

      return {
        id: row.id,
        name: label,
        kind: "file" as const,
        href,
        detail: `School key · ${keyRow.schoolKey.testId || keyRow.platform.testId}`,
        testId: keyRow.schoolKey.testId || keyRow.platform.testId || "",
        modified: keyRow.schoolKey.updatedAt,
        actions: [
          { label: "Edit answers", href, icon: "edit" as const },
          { label: "View", href, icon: "view" as const },
        ],
      };
    });

    return (
      <DriveBrowser
        key={`school-keys:${school.id}:program:${programCode}:test:${testNumber}`}
        breadcrumbs={[{ label: "School Keys", href: SCHOOL_KEYS_PATH }, ...folderCrumbs]}
        items={[...sectionItems, ...classItems].sort((a, b) => a.name.localeCompare(b.name))}
        emptyText={`No classes or sections for ${programName}. Add them on the school profile.`}
        searchPlaceholder="Search classes"
      />
    );
  }

  return (
    <DriveBrowser
      key="school-keys:schools"
      breadcrumbs={[{ label: "School Keys", href: SCHOOL_KEYS_PATH }]}
      items={schools
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({
          id: item.id,
          name: item.name,
          kind: "folder" as const,
          href: schoolHref(item.id),
          detail: item.code,
        }))}
      emptyText="No schools yet."
      searchPlaceholder="Search schools"
    />
  );
}
