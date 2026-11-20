import { SchoolClassesWorkspace } from "@/features/students/school-classes-workspace";
import { verifySchoolSession } from "@/features/school-auth/session";
import { listSchoolClassOrganization } from "@/services/sections";
import { getSchoolStudentCounts, listSchoolStudents } from "@/services/students";
import { listSchoolClassTeacherSlots, listSchoolTeachers } from "@/services/teachers";

export default async function SchoolClassesPage() {
  const [school, teachersList, classTeacherSlots, organization, counts, studentsPage] =
    await Promise.all([
      verifySchoolSession(),
      listSchoolTeachers({ pageSize: 50, status: "ACTIVE" }),
      listSchoolClassTeacherSlots(),
      listSchoolClassOrganization(),
      getSchoolStudentCounts(),
      listSchoolStudents({ pageSize: 500, status: "ACTIVE" }),
    ]);

  const enrolledByWhole: Record<string, number> = {};
  for (const row of organization.wholeClasses) {
    const match = counts.byWhole.find(
      (item) => item.programId === row.programId && item.classLevel === row.classLevel,
    );
    enrolledByWhole[row.id] = match?.count ?? 0;
  }

  // One school roster for Classes, Students, and Results — no program-offerings filter.
  const students = studentsPage.items;

  return (
    <SchoolClassesWorkspace
      schoolPrograms={school.schoolPrograms}
      teachers={teachersList.items}
      classTeacherSlots={classTeacherSlots}
      students={students}
      sections={organization.sections}
      enrolledBySection={counts.bySection}
      enrolledByWhole={enrolledByWhole}
    />
  );
}
