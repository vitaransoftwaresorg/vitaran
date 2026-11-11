import { PageHeader } from "@/features/admin/page-header";
import { verifySchoolSession } from "@/features/school-auth/session";
import { createSchoolTeacherAction } from "@/features/teachers/actions";
import { TeacherForm } from "@/features/teachers/teacher-form";
import { listSchoolSections } from "@/services/sections";
import { listSchoolClassTeacherSlots } from "@/services/teachers";

export default async function NewSchoolTeacherPage() {
  const [school, classTeacherSlots, sections] = await Promise.all([
    verifySchoolSession(),
    listSchoolClassTeacherSlots(),
    listSchoolSections(),
  ]);

  return (
    <>
      <PageHeader
        title="Add teacher"
        description="Pick program → class. With sections: section → subjects → class teacher."
      />
      <TeacherForm
        schoolPrograms={school.schoolPrograms}
        sections={sections}
        classTeacherSlots={classTeacherSlots}
        action={createSchoolTeacherAction}
        cancelHref="/school/teachers"
        successHref="/school/teachers"
      />
    </>
  );
}
