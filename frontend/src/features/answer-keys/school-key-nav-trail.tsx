"use client";

import { useEffect } from "react";
import { useSetDrivePathCrumbs } from "@/components/layout/drive-path-context";
import {
  readAnswerKeysFolderCrumbs,
  writeAnswerKeysFolderTrail,
} from "@/features/answer-keys/drive-path";
import { SCHOOL_KEYS_PATH } from "@/features/answer-keys/constants";
import { rememberAdminNavLabel } from "@/features/admin/nav-labels";

type SchoolKeyNavTrailProps = {
  school: { id: string; name: string };
  programCode: string;
  programName?: string | null;
  classLevel: number;
  testNumber: number;
};

/** Top nav: School → Program → Test N → Class while editing a school key. */
export function SchoolKeyNavTrail({
  school,
  programCode,
  programName,
  classLevel,
  testNumber,
}: SchoolKeyNavTrailProps) {
  const setCrumbs = useSetDrivePathCrumbs();

  useEffect(() => {
    rememberAdminNavLabel("school", school.id, school.name);

    const schoolOnly = `${SCHOOL_KEYS_PATH}?school=${encodeURIComponent(school.id)}`;
    const programOnly = `${SCHOOL_KEYS_PATH}?${new URLSearchParams({
      school: school.id,
      program: programCode,
    })}`;
    const testOnly = `${SCHOOL_KEYS_PATH}?${new URLSearchParams({
      school: school.id,
      program: programCode,
      test: String(testNumber),
    })}`;

    // Class-wise school keys — nav shows Class N (not section-specific).
    const classLabel = `Class ${classLevel}`;

    const stored = readAnswerKeysFolderCrumbs();
    const hasTest = stored.some((crumb) => crumb.label === `Test ${testNumber}`);
    const trail = hasTest
      ? [
          ...stored.filter((crumb) => !/^Class\s+/i.test(crumb.label)),
          { label: classLabel, href: testOnly },
        ]
      : [
          { label: school.name, href: schoolOnly },
          { label: programName?.trim() || programCode, href: programOnly },
          { label: `Test ${testNumber}`, href: testOnly },
          { label: classLabel, href: testOnly },
        ];

    writeAnswerKeysFolderTrail(testOnly, trail);
    setCrumbs?.(trail);
  }, [
    school.id,
    school.name,
    programCode,
    programName,
    classLevel,
    testNumber,
    setCrumbs,
  ]);

  return null;
}
