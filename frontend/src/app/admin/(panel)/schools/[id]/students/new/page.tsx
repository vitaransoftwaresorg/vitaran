import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { createAdminStudentsBulkAction } from "@/features/students/admin-student-actions";
import { BulkStudentForm } from "@/features/students/bulk-student-form";
import { listAdminSchoolSections } from "@/services/sections";
import { getSchool } from "@/services/schools";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSchoolStudentNewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const classLevelRaw = Number(first(query.class));
  const classLevel =
    Number.isInteger(classLevelRaw) && classLevelRaw >= 1 && classLevelRaw <= 12
      ? classLevelRaw
      : undefined;
  const sectionName = first(query.section)?.trim().toUpperCase() || undefined;

  const [school, organization] = await Promise.all([
    getSchool(id),
    listAdminSchoolSections(id),
  ]);
  if (!school) notFound();

  const matchingSection =
    classLevel != null && sectionName
      ? organization.sections.find(
          (section) =>
            section.classLevel === classLevel &&
            section.name.trim().toUpperCase() === sectionName,
        )
      : undefined;

  const returnTo =
    classLevel != null && sectionName
      ? `/admin/schools/students?school=${id}&class=${classLevel}&section=${encodeURIComponent(sectionName)}`
      : `/admin/schools/students?school=${id}`;

  const submitAction = createAdminStudentsBulkAction.bind(null, id);

  return (
    <>
      <PageHeader
        title="Add students"
        description={
          classLevel != null && sectionName
            ? `${school.name} · Class ${classLevel}-${sectionName}`
            : school.name
        }
      />
      <div className="mt-3">
        <BulkStudentForm
          schoolPrograms={school.schoolPrograms}
          sections={organization.sections}
          defaults={
            matchingSection
              ? {
                  programId: matchingSection.programId,
                  classLevel: matchingSection.classLevel,
                  sectionId: matchingSection.id,
                }
              : undefined
          }
          lockPlacement={Boolean(matchingSection)}
          returnTo={returnTo}
          submitAction={submitAction}
        />
      </div>
    </>
  );
}
