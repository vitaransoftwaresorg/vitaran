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
  const sectionRaw = first(query.section);
  const sectionId = sectionRaw && UUID.test(sectionRaw) ? sectionRaw : undefined;
  const classRaw = Number(first(query.class));
  const classLevel =
    sectionId == null && Number.isInteger(classRaw) && classRaw >= 1 && classRaw <= 12
      ? classRaw
      : undefined;

  const schools = await listSchoolOptions();
  const school = schoolId ? schools.find((item) => item.id === schoolId) : undefined;
  const organization = school ? await listAdminSchoolSections(school.id) : null;

  let board: SchoolKeyBoard | null = null;
  if (school && (sectionId || classLevel != null)) {
    try {
      board = await listSchoolSectionKeys({
        schoolId: school.id,
        ...(sectionId ? { sectionId } : {}),
        ...(classLevel != null ? { classLevel } : {}),
      });
    } catch {
      board = {
        school: { id: school.id, name: school.name, code: school.code },
        sectionId: sectionId ?? null,
        sectionName: null,
        classLevel: classLevel ?? 0,
        programCode: programCode ?? "",
        items: [],
      };
    }
  }

  return (
    <SchoolKeysDrive
      schools={schools}
      schoolId={school?.id}
      programCode={programCode}
      sectionId={sectionId}
      classLevel={classLevel}
      organization={organization}
      board={board}
    />
  );
}
