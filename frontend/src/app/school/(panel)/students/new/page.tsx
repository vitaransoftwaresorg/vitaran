import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { verifySchoolSession } from "@/features/school-auth/session";
import { BulkStudentForm } from "@/features/students/bulk-student-form";
import { listSchoolClassOrganization } from "@/services/sections";

export const metadata: Metadata = { title: "Add students" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SchoolStudentNewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const classLevelRaw = Number(first(query.class));
  const classLevel =
    Number.isInteger(classLevelRaw) && classLevelRaw >= 1 && classLevelRaw <= 12
      ? classLevelRaw
      : undefined;
  const sectionName = first(query.section)?.trim().toUpperCase() || undefined;

  const [school, organization] = await Promise.all([
    verifySchoolSession(),
    listSchoolClassOrganization(),
  ]);

  const matchingSection =
    classLevel != null && sectionName
      ? organization.sections.find(
          (section) =>
            section.classLevel === classLevel &&
            section.name.trim().toUpperCase() === sectionName,
        )
      : undefined;

  const classSections =
    classLevel != null
      ? organization.sections.filter((section) => section.classLevel === classLevel)
      : [];
  const classWhole =
    classLevel != null
      ? organization.wholeClasses.find((row) => row.classLevel === classLevel)
      : undefined;

  const wholeOnly =
    classLevel != null && classSections.length === 0 && Boolean(classWhole);

  const defaults = matchingSection
    ? {
        programId: matchingSection.programId,
        classLevel: matchingSection.classLevel,
        sectionId: matchingSection.id,
      }
    : wholeOnly && classWhole
      ? {
          programId: classWhole.programId,
          classLevel: classWhole.classLevel,
          sectionId: null as string | null,
        }
      : classLevel != null
        ? {
            programId: classSections[0]?.programId ?? classWhole?.programId,
            classLevel,
          }
        : undefined;

  // Same add page from Students or Classes — lock when opened for a specific class/section.
  const lockPlacement = Boolean(matchingSection || wholeOnly);

  const returnTo =
    classLevel != null
      ? sectionName
        ? `/school/students?class=${classLevel}&section=${encodeURIComponent(sectionName)}`
        : `/school/students?class=${classLevel}`
      : "/school/students";

  return (
    <>
      <PageHeader
        title="Add students"
        description={
          classLevel != null
            ? sectionName
              ? `${school.name} · Class ${classLevel}-${sectionName}`
              : `${school.name} · Class ${classLevel}`
            : school.name
        }
      />
      <div className="mt-3">
        <BulkStudentForm
          schoolPrograms={school.schoolPrograms}
          sections={organization.sections}
          defaults={defaults}
          lockPlacement={lockPlacement}
          returnTo={returnTo}
        />
      </div>
    </>
  );
}
