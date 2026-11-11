import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { createAdminTeacherAction } from "@/features/teachers/actions";
import { TeacherForm } from "@/features/teachers/teacher-form";
import { listAdminSchoolSections } from "@/services/sections";
import { listAdminClassTeacherSlots } from "@/services/teachers";
import { getSchool } from "@/services/schools";

export default async function AdminNewTeacherPage({
  params,
}: PageProps<"/admin/schools/[id]/teachers/new">) {
  const { id } = await params;
  const [school, classTeacherSlots, sections] = await Promise.all([
    getSchool(id),
    listAdminClassTeacherSlots(id),
    listAdminSchoolSections(id),
  ]);
  if (!school) notFound();

  return (
    <>
      <PageHeader
        title="Add teacher"
        description={`${school.name} · assign subjects and class-teacher slots`}
      />
      <TeacherForm
        schoolPrograms={school.schoolPrograms}
        sections={sections.sections}
        classTeacherSlots={classTeacherSlots}
        action={createAdminTeacherAction.bind(null, school.id)}
        cancelHref={`/admin/teachers?school=${school.id}`}
        successHref={`/admin/teachers?school=${school.id}`}
      />
    </>
  );
}
