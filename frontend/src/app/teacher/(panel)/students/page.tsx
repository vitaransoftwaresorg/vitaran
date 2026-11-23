import { ListPagination } from "@/components/shared/list-pagination";
import { PageHeader } from "@/features/admin/page-header";
import {
  DEFAULT_STUDENTS_PAGE_SIZE,
  parseListPage,
  parseListPageSize,
} from "@/features/list/page-params";
import { StudentsByClass } from "@/features/students/class-profile-cards";
import { verifyTeacherSession } from "@/features/teacher-auth/session";
import { listTeacherStudents } from "@/services/students";

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const page = parseListPage(query.page);
  const pageSize = parseListPageSize(query.pageSize, DEFAULT_STUDENTS_PAGE_SIZE, 100);

  const [teacher, list] = await Promise.all([
    verifyTeacherSession(),
    listTeacherStudents({ page, pageSize }),
  ]);

  const ctLabels = (teacher.classTeacherSections ?? []).map((row) =>
    row.kind === "section"
      ? `Class ${row.classLevel}-${row.sectionName}`
      : `Class ${row.classLevel}`,
  );

  return (
    <>
      <PageHeader
        description={
          ctLabels.length
            ? `Class teacher of ${ctLabels.join(", ")} · plus assigned classes`
            : "Students in your assigned programs and classes"
        }
        count={list.pagination.total}
      />
      <div className="space-y-4">
        <StudentsByClass
          portal="teacher"
          students={list.items}
          schoolPrograms={teacher.school.schoolPrograms}
          emptyMessage="No students in your classes yet."
        />
        {list.pagination.total > 0 ? (
          <div className="rounded-xl border border-brand-200 bg-white">
            <ListPagination
              pagination={list.pagination}
              basePath="/teacher/students"
              searchParams={{
                pageSize: pageSize === DEFAULT_STUDENTS_PAGE_SIZE ? undefined : pageSize,
              }}
              noun="students"
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
