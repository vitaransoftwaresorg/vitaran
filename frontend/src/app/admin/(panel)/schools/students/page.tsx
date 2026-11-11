import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { ClassProfilesPdfActions } from "@/features/students/student-pdf-actions";
import { StudentsDrive } from "@/features/students/students-drive";
import { studentsForSchoolOfferings } from "@/features/students/school-roster";
import { cn } from "@/lib/utils";
import { listAdminSchoolSections } from "@/services/sections";
import { listSchoolOptions } from "@/services/schools";
import { listAdminSchoolStudents } from "@/services/students";

export const metadata: Metadata = { title: "Students" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminAllStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const schoolIdRaw = first(query.school);
  const schoolId = schoolIdRaw && UUID.test(schoolIdRaw) ? schoolIdRaw : undefined;
  const classLevelRaw = Number(first(query.class));
  const classLevel =
    Number.isInteger(classLevelRaw) && classLevelRaw >= 1 && classLevelRaw <= 12
      ? classLevelRaw
      : undefined;
  const section = first(query.section)?.trim().toUpperCase() || undefined;

  const schools = await listSchoolOptions();
  const school = schoolId ? schools.find((item) => item.id === schoolId) : undefined;

  const [students, organization] = school
    ? await Promise.all([
        listAdminSchoolStudents(school.id, { pageSize: 500 }).then((page) =>
          studentsForSchoolOfferings(school, page.items),
        ),
        listAdminSchoolSections(school.id),
      ])
    : [[], null];

  const inClass = Boolean(school && classLevel != null && section);
  const title = school ? (inClass ? `Class ${classLevel}-${section}` : school.name) : "Students";
  const description = school
    ? inClass
      ? `${school.name} · students`
      : "Open a class section to view students"
    : "Open a school to view its classes";
  const roster = inClass
    ? students.filter(
        (student) =>
          student.classLevel === classLevel &&
          (student.sectionName?.trim().toUpperCase() || "A") === section,
      )
    : [];
  const rosterCount = inClass ? roster.length : undefined;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        count={school ? rosterCount : schools.length}
        actions={
          school ? (
            <div className="flex flex-wrap items-center gap-2">
              {inClass ? (
                <ClassProfilesPdfActions
                  portal="admin"
                  studentIds={roster.map((student) => student.id)}
                />
              ) : null}
              <Link
                href={
                  inClass
                    ? `/admin/schools/${school.id}/students/new?class=${classLevel}&section=${encodeURIComponent(section!)}`
                    : `/admin/schools/${school.id}/students/new`
                }
                className={cn(buttonVariants({ size: "sm" }), "h-8 gap-1.5 rounded-lg")}
              >
                <Plus className="size-4" />
                Add student
              </Link>
            </div>
          ) : null
        }
      />
      <StudentsDrive
        schools={schools}
        schoolId={school?.id}
        classLevel={classLevel}
        section={section}
        organization={organization}
        students={students}
      />
    </>
  );
}
