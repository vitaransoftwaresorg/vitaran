import { PageHeader } from "@/features/admin/page-header";
import { StudentsByClass } from "@/features/students/class-profile-cards";
import { verifyTeacherSession } from "@/features/teacher-auth/session";
import { listTeacherStudents } from "@/services/students";

export default async function TeacherStudentsPage() {
  const [teacher, list] = await Promise.all([
    verifyTeacherSession(),
    listTeacherStudents({ pageSize: 500 }),
  ]);

  const ctLabels = (teacher.classTeacherSections ?? []).map((row) =>
    row.kind === "section"
      ? `Class ${row.classLevel}-${row.sectionName}`
      : `Class ${row.classLevel}`,
  );

  return (
    <>
      <PageHeader
        title="Students"
        description={
          ctLabels.length
            ? `Class teacher of ${ctLabels.join(", ")} · plus assigned classes`
            : "Students in your assigned programs and classes"
        }
        count={list.pagination.total}
      />
      <StudentsByClass
        portal="teacher"
        students={list.items}
        emptyMessage="No students in your classes yet."
      />
    </>
  );
}
