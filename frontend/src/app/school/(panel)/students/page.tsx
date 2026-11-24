import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { verifySchoolSession } from "@/features/school-auth/session";
import {
  DEFAULT_STUDENTS_PAGE_SIZE,
  parseListPage,
  parseListPageSize,
} from "@/features/list/page-params";
import { DeleteRosterStudentsButton } from "@/features/students/delete-roster-students-button";
import { SchoolStudentsDrive } from "@/features/students/school-students-drive";
import { sectionIdsForClass, studentsInClass } from "@/features/students/school-roster";
import { subjectsForSchoolClass } from "@/features/students/report-subjects";
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
  const page = parseListPage(query.page);
  const pageSize = parseListPageSize(query.pageSize, DEFAULT_STUDENTS_PAGE_SIZE, 100);

  const school = await verifySchoolSession();

  const organization = await listSchoolClassOrganization();
  const sectionIds =
    classLevel != null && section
      ? sectionIdsForClass(organization, classLevel, section)
      : undefined;
  const hasSections =
    classLevel != null &&
    (organization.sections ?? []).some((row) => row.classLevel === classLevel);
  const showRosterTable = Boolean(classLevel != null && (section || !hasSections));

  const studentsPage = await listSchoolStudents({
    status: "ACTIVE",
    ...(classLevel != null ? { classLevel } : {}),
    ...(sectionIds?.length === 1 ? { sectionId: sectionIds[0] } : {}),
    ...(showRosterTable ? { page, pageSize } : { pageSize: 500 }),
  });
  const students = studentsPage.items;

  const inClass = classLevel != null;
  const title = inClass
    ? section
      ? `Class ${classLevel}-${section}`
      : `Class ${classLevel}`
    : "Students";
  const description = inClass
    ? section
      ? `${school.name} · section students`
      : hasSections
        ? `${school.name} · open a section`
        : `${school.name} · students`
    : "Open a class to view students";
  const roster =
    inClass && classLevel != null
      ? studentsInClass(students, classLevel, section, { sectionIds })
      : [];
  const headerCount = showRosterTable
    ? studentsPage.pagination.total
    : inClass
      ? roster.length
      : students.length;
  const classSubjects =
    inClass && classLevel != null
      ? subjectsForSchoolClass(
          school.schoolPrograms,
          classLevel,
          roster[0]?.programId ?? students.find((student) => student.classLevel === classLevel)?.programId,
        )
      : [];

  return (
    <>
      <PageHeader
        title={inClass ? title : undefined}
        description={description}
        count={headerCount}
        actions={
          inClass && classLevel != null ? (
            <div className="flex flex-wrap items-end gap-2">
              <ClassProfilesPdfActions
                portal="school"
                studentIds={roster.map((student) => student.id)}
                scopeLabel={title}
                schoolName={school.name}
                subjects={classSubjects}
              />
              <div className="flex flex-col items-stretch gap-1.5">
                {section || !(organization.sections ?? []).some((row) => row.classLevel === classLevel) ? (
                  <DeleteRosterStudentsButton
                    mode="school"
                    classLevel={classLevel}
                    sectionId={sectionIds?.length === 1 ? sectionIds[0] : null}
                    sectionLabel={section}
                    studentCount={showRosterTable ? studentsPage.pagination.total : roster.length}
                  />
                ) : null}
                <Link
                  href={
                    section
                      ? `/school/students/new?class=${classLevel}&section=${encodeURIComponent(section)}`
                      : `/school/students/new?class=${classLevel}`
                  }
                  className={cn(buttonVariants({ size: "sm" }), "h-8 gap-1.5 rounded-lg")}
                >
                  <Plus className="size-4" />
                  Add students
                </Link>
              </div>
            </div>
          ) : (
            <Link
              href="/school/students/import"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-8 gap-1.5 rounded-lg")}
            >
              <FileSpreadsheet className="size-4" />
              Import all students
            </Link>
          )
        }
      />
      <SchoolStudentsDrive
        classLevel={classLevel}
        section={section}
        organization={organization}
        students={students}
        schoolPrograms={school.schoolPrograms}
        pagination={showRosterTable ? studentsPage.pagination : undefined}
        listParams={{
          pageSize: pageSize === DEFAULT_STUDENTS_PAGE_SIZE ? undefined : pageSize,
        }}
      />
    </>
  );
}
