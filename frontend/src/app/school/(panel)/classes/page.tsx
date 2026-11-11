import { SchoolClassesWorkspace } from "@/features/students/school-classes-workspace";
import { verifySchoolSession } from "@/features/school-auth/session";
import { listSchoolClassOrganization } from "@/services/sections";
import { getSchoolStudentCounts } from "@/services/students";
import { listSchoolClassTeacherSlots, listSchoolTeachers } from "@/services/teachers";

export default async function SchoolClassesPage() {
  const [school, teachersList, classTeacherSlots, organization, counts] = await Promise.all([
    verifySchoolSession(),
    listSchoolTeachers({ pageSize: 50, status: "ACTIVE" }),
    listSchoolClassTeacherSlots(),
    listSchoolClassOrganization(),
    getSchoolStudentCounts(),
  ]);

  const enrolledByWhole: Record<string, number> = {};
  for (const row of organization.wholeClasses) {
    const match = counts.byWhole.find(
      (item) => item.programId === row.programId && item.classLevel === row.classLevel,
    );
    enrolledByWhole[row.id] = match?.count ?? 0;
  }

  return (
    <SchoolClassesWorkspace
      schoolPrograms={school.schoolPrograms}
      teachers={teachersList.items}
      classTeacherSlots={classTeacherSlots}
      students={[]}
      sections={organization.sections}
      enrolledBySection={counts.bySection}
      enrolledByWhole={enrolledByWhole}
    />
  );
}
