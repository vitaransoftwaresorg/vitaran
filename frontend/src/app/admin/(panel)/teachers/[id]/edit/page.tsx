import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { updateAdminTeacherAction } from "@/features/teachers/actions";
import { TeacherForm } from "@/features/teachers/teacher-form";
import { listAdminSchoolSections } from "@/services/sections";
import { getAdminTeacher, listAdminClassTeacherSlots } from "@/services/teachers";
import { getSchool } from "@/services/schools";

function ownedTokens(
  slots: Awaited<ReturnType<typeof listAdminClassTeacherSlots>>,
  teacherId: string,
) {
  return slots
    .filter((slot) => slot.teacherId === teacherId)
    .map((slot) =>
      slot.kind === "section"
        ? `section:${slot.sectionId}`
        : `class:${slot.programId}:${slot.classLevel}`,
    );
}

export default async function AdminEditTeacherPage({
  params,
}: PageProps<"/admin/teachers/[id]/edit">) {
  const { id } = await params;
  const teacher = await getAdminTeacher(id);
  if (!teacher) notFound();
  const [school, classTeacherSlots, sections] = await Promise.all([
    getSchool(teacher.schoolId),
    listAdminClassTeacherSlots(teacher.schoolId),
    listAdminSchoolSections(teacher.schoolId),
  ]);
  if (!school) notFound();

  return (
    <>
      <PageHeader title="Edit teacher" description={`${teacher.name} · ${school.name}`} />
      <TeacherForm
        teacher={teacher}
        schoolPrograms={school.schoolPrograms}
        sections={sections.sections}
        classTeacherSlots={classTeacherSlots}
        myClassTeacherTokens={ownedTokens(classTeacherSlots, teacher.id)}
        action={updateAdminTeacherAction.bind(null, teacher.id)}
        cancelHref="/admin/teachers"
        successHref="/admin/teachers"
      />
    </>
  );
}
