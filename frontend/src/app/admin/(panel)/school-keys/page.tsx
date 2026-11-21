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
  const testRaw = Number(first(query.test));
  const testNumber =
    Number.isInteger(testRaw) && testRaw >= 1 && testRaw <= 18 ? testRaw : undefined;

  const schools = await listSchoolOptions();
  const school = schoolId ? schools.find((item) => item.id === schoolId) : undefined;
  const organization = school ? await listAdminSchoolSections(school.id) : null;

  const boardsByScope: Record<string, SchoolKeyBoard> = {};

  if (school && organization && testNumber != null) {
    const scopes: Array<{ key: string; sectionId?: string; classLevel?: number }> = [];
    for (const section of organization.sections) {
      scopes.push({ key: section.id, sectionId: section.id });
    }
    const sectionLevels = new Set(organization.sections.map((section) => section.classLevel));
    for (const row of organization.wholeClasses) {
      if (sectionLevels.has(row.classLevel)) continue;
      scopes.push({ key: `class:${row.classLevel}`, classLevel: row.classLevel });
    }

    const boards = await Promise.all(
      scopes.map(async (scope) => {
        try {
          const board = await listSchoolSectionKeys({
            schoolId: school.id,
            ...(scope.sectionId ? { sectionId: scope.sectionId } : {}),
            ...(scope.classLevel != null ? { classLevel: scope.classLevel } : {}),
          });
          return [scope.key, board] as const;
        } catch {
          return null;
        }
      }),
    );

    for (const entry of boards) {
      if (entry) boardsByScope[entry[0]] = entry[1];
    }
  }

  return (
    <SchoolKeysDrive
      schools={schools}
      schoolId={school?.id}
      testNumber={testNumber}
      organization={organization}
      boardsByScope={boardsByScope}
    />
  );
}
