import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { verifySchoolSession } from "@/features/school-auth/session";
import { updateSchoolTeacherAction } from "@/features/teachers/actions";
import { TeacherForm } from "@/features/teachers/teacher-form";
import { listSchoolSections } from "@/services/sections";
import { getSchoolTeacher, listSchoolClassTeacherSlots } from "@/services/teachers";

function ownedTokens(
  slots: Awaited<ReturnType<typeof listSchoolClassTeacherSlots>>,
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

export default async function EditSchoolTeacherPage({
  params,
}: PageProps<"/school/teachers/[id]/edit">) {
  const { id } = await params;
  const [school, teacher, classTeacherSlots, sections] = await Promise.all([
    verifySchoolSession(),
    getSchoolTeacher(id),
    listSchoolClassTeacherSlots(),
    listSchoolSections(),
  ]);
  if (!teacher) notFound();

  return (
    <>
      <PageHeader title="Edit teacher" description={teacher.email} />
      <TeacherForm
        teacher={teacher}
        schoolPrograms={school.schoolPrograms}
        sections={sections}
        classTeacherSlots={classTeacherSlots}
        myClassTeacherTokens={ownedTokens(classTeacherSlots, teacher.id)}
        action={updateSchoolTeacherAction.bind(null, teacher.id)}
        cancelHref="/school/teachers"
        successHref="/school/teachers"
      />
    </>
  );
}
