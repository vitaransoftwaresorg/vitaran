import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { verifySchoolSession } from "@/features/school-auth/session";
import { displaySectionName } from "@/features/schools/section-label";
import { SchoolStudentsDrive } from "@/features/students/school-students-drive";
import { ClassProfilesPdfActions } from "@/features/students/student-pdf-actions";
import { cn } from "@/lib/utils";
import { listSchoolClassOrganization } from "@/services/sections";
import { listSchoolStudents } from "@/services/students";

export const metadata: Metadata = { title: "Students" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SchoolStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const classLevelRaw = Number(first(query.class));
  const classLevel =
    Number.isInteger(classLevelRaw) && classLevelRaw >= 1 && classLevelRaw <= 12
      ? classLevelRaw
      : undefined;
  const section = first(query.section)?.trim().toUpperCase() || undefined;

  const school = await verifySchoolSession();
  const allowedPrograms = new Set(school.programCodes);

  const [studentsPage, organization] = await Promise.all([
    listSchoolStudents({ pageSize: 500 }),
    listSchoolClassOrganization(),
  ]);

  const students = studentsPage.items.filter(
    (student) => allowedPrograms.size === 0 || allowedPrograms.has(student.programCode),
  );

  const inClass = classLevel != null && Boolean(section);
  const title = inClass ? `Class ${classLevel}-${section}` : "Students";
  const description = inClass
    ? `${school.name} · students`
    : "Open a class section to view students";
  const roster = inClass
    ? students.filter(
        (student) =>
          student.classLevel === classLevel && displaySectionName(student.sectionName) === section,
      )
    : [];
  const rosterCount = inClass ? roster.length : students.length;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        count={rosterCount}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {inClass ? (
              <ClassProfilesPdfActions
                portal="school"
                studentIds={roster.map((student) => student.id)}
              />
            ) : null}
            <Link
              href={
                inClass
                  ? `/school/students/new?class=${classLevel}&section=${encodeURIComponent(section!)}`
                  : "/school/students/new"
              }
              className={cn(buttonVariants({ size: "sm" }), "h-8 gap-1.5 rounded-lg")}
            >
              <Plus className="size-4" />
              Add student
            </Link>
          </div>
        }
      />
      <SchoolStudentsDrive
        classLevel={classLevel}
        section={section}
        organization={organization}
        students={students}
      />
    </>
  );
}
