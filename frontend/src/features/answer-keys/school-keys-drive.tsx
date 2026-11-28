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
  sectionId?: string;
  classLevel?: number;
  organization?: ClassOrganization | null;
  board?: SchoolKeyBoard | null;
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

function sectionHref(schoolId: string, program: string, sectionId: string) {
  return `${SCHOOL_KEYS_PATH}?${new URLSearchParams({
    school: schoolId,
    program,
    section: sectionId,
  })}`;
}

function classHref(schoolId: string, program: string, classLevel: number) {
  return `${SCHOOL_KEYS_PATH}?${new URLSearchParams({
    school: schoolId,
    program,
    class: String(classLevel),
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
  sectionId,
  classLevel,
  organization,
  board = null,
}: SchoolKeysDriveProps) {
  const router = useRouter();
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [, startCreating] = useTransition();

  const school = schools.find((item) => item.id === schoolId);
  const scope =
    sectionId != null
      ? { sectionId }
      : classLevel != null
        ? { classLevel }
        : undefined;

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
  if (schoolId && school && programCode && sectionId && organization) {
    const section = organization.sections.find((item) => item.id === sectionId);
    if (section) {
      folderCrumbs.push({
        label: `Class ${section.classLevel}-${displaySectionName(section.name)}`,
        href: sectionHref(school.id, programCode, section.id),
      });
    }
  } else if (schoolId && school && programCode && classLevel != null) {
    folderCrumbs.push({
      label: `Class ${classLevel}`,
      href: classHref(school.id, programCode, classLevel),
    });
  }

  useEffect(() => {
    if (school) rememberAdminNavLabel("school", school.id, school.name);
    writeAnswerKeysFolderTrail(
      `${window.location.pathname}${window.location.search}`,
      folderCrumbs,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, school?.id, school?.name, programCode, sectionId, classLevel]);

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

  // School → program → classes & sections
  if (schoolId && school && programCode && !scope && organization) {
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

    const sectionItems: DriveItem[] = sections.map((section) => ({
      id: section.id,
      name: `Class ${section.classLevel}-${displaySectionName(section.name)}`,
      kind: "folder" as const,
      href: sectionHref(school.id, programCode, section.id),
      detail: "Tests",
    }));

    const classItems: DriveItem[] = wholeClasses.map((row) => ({
      id: row.id,
      name: `Class ${row.classLevel}`,
      kind: "folder" as const,
      href: classHref(school.id, programCode, row.classLevel),
      detail: "Tests",
    }));

    return (
      <DriveBrowser
        key={`school-keys:${school.id}:program:${programCode}`}
        breadcrumbs={[{ label: "School Keys", href: SCHOOL_KEYS_PATH }, ...folderCrumbs]}
        items={[...sectionItems, ...classItems].sort((a, b) => a.name.localeCompare(b.name))}
        emptyText={`No classes or sections for ${programName}. Add them on the school profile.`}
        searchPlaceholder="Search classes"
      />
    );
  }

  // School → program → class/section → tests
  if (schoolId && school && programCode && scope && board) {
    const from =
      scope.sectionId != null
        ? sectionHref(school.id, programCode, scope.sectionId)
        : classHref(school.id, programCode, scope.classLevel!);

    const items: DriveItem[] = DRIVE_TESTS.map((number) => {
      const row = board.items.find((item) => item.platform.testNumber === number);
      const createKey = `${scope.sectionId ?? `class:${scope.classLevel}`}:${number}`;

      if (!row?.platform) {
        return {
          id: String(number),
          name: `Test ${number}`,
          kind: "empty" as const,
          detail: "No platform key — add under Answer Keys first",
          createLabel: "Unavailable",
          creating: false,
          onCreate: () => {
            toast.error("Add a platform answer key for this class under Answer Keys first.");
          },
        };
      }

      const filled = row.schoolKey?.answerCount ?? 0;
      const href = row.schoolKey
        ? documentAnswersHref(SCHOOL_KEYS_PATH, row.schoolKey.id, from)
        : undefined;

      if (!row.schoolKey || filled === 0) {
        return {
          id: String(number),
          name: `Test ${number}`,
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
            openSchoolKey(row.platform.id, scope.sectionId ?? null, createKey, from);
          },
        };
      }

      return {
        id: String(number),
        name: `Test ${number}`,
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

    return (
      <DriveBrowser
        key={`school-keys:${school.id}:scope:${scope.sectionId ?? `class:${scope.classLevel}`}`}
        breadcrumbs={[{ label: "School Keys", href: SCHOOL_KEYS_PATH }, ...folderCrumbs]}
        items={items}
        emptyText="No tests yet."
        searchPlaceholder="Search tests"
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
