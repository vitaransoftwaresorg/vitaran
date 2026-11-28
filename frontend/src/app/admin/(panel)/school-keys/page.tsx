import type { Metadata } from "next";
import {
  SchoolKeysDrive,
  type SchoolKeyBoard,
} from "@/features/answer-keys/school-keys-drive";
import { listSchoolSectionKeys } from "@/services/answer-keys";
import { listAdminSchoolSections } from "@/services/sections";
import { listSchoolOptions } from "@/services/schools";

export const metadata: Metadata = { title: "School Keys" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSchoolKeysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const schoolIdRaw = first(query.school);
  const schoolId = schoolIdRaw && UUID.test(schoolIdRaw) ? schoolIdRaw : undefined;
  const programRaw = first(query.program)?.trim().toUpperCase();
  const programCode = programRaw || undefined;
  const testRaw = Number(first(query.test));
  const testNumber =
    Number.isInteger(testRaw) && testRaw >= 1 && testRaw <= 18 ? testRaw : undefined;

  const schools = await listSchoolOptions();
  const school = schoolId ? schools.find((item) => item.id === schoolId) : undefined;
  const organization = school ? await listAdminSchoolSections(school.id) : null;

  const boardsByScope: Record<string, SchoolKeyBoard> = {};

  // Class-wise keys only (not per section) for the selected program + test.
  if (school && organization && programCode && testNumber != null) {
    const classLevels = new Set<number>();
    for (const section of organization.sections) {
      const code = (section.programCode || "").trim().toUpperCase();
      if (code === programCode.toUpperCase()) classLevels.add(section.classLevel);
    }
    for (const row of organization.wholeClasses) {
      const code = (row.programCode || "").trim().toUpperCase();
      if (code === programCode.toUpperCase()) classLevels.add(row.classLevel);
    }

    const boards = await Promise.all(
      [...classLevels].sort((a, b) => a - b).map(async (classLevel) => {
        const key = `class:${classLevel}`;
        try {
          const board = await listSchoolSectionKeys({
            schoolId: school.id,
            classLevel,
          });
          return [key, board] as const;
        } catch {
          return [
            key,
            {
              school: { id: school.id, name: school.name, code: school.code },
              sectionId: null,
              sectionName: null,
              classLevel,
              programCode: programCode ?? "",
              items: [],
            } satisfies SchoolKeyBoard,
          ] as const;
        }
      }),
    );

    for (const entry of boards) {
      boardsByScope[entry[0]] = entry[1];
    }
  }

  return (
    <SchoolKeysDrive
      schools={schools}
      schoolId={school?.id}
      programCode={programCode}
      testNumber={testNumber}
      organization={organization}
      boardsByScope={boardsByScope}
    />
  );
}
