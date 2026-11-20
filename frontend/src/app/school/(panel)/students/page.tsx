import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { verifySchoolSession } from "@/features/school-auth/session";
import { SchoolStudentsDrive } from "@/features/students/school-students-drive";
import {
  filterStudentsByProgramCodes,
  studentsInClass,
} from "@/features/students/school-roster";
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

  const school = await verifySchoolSession();

  const [studentsPage, organization] = await Promise.all([
    listSchoolStudents({ pageSize: 500 }),
    listSchoolClassOrganization(),
  ]);

  const students = filterStudentsByProgramCodes(studentsPage.items, school.programCodes);

  const inClass = classLevel != null;
  const title = inClass
    ? section
      ? `Class ${classLevel}-${section}`
      : `Class ${classLevel}`
    : "Students";
  const description = inClass
    ? section
      ? `${school.name} · students`
      : `${school.name} · all sections`
    : "Open a class to view students";
  const roster = inClass && classLevel != null ? studentsInClass(students, classLevel, section) : [];
  const rosterCount = inClass ? roster.length : students.length;
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
        count={rosterCount}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {inClass ? (
              <ClassProfilesPdfActions
                portal="school"
                studentIds={roster.map((student) => student.id)}
                scopeLabel={title}
                schoolName={school.name}
                subjects={classSubjects}
              />
            ) : null}
            <Link
              href={
                inClass
                  ? section
                    ? `/school/students/new?class=${classLevel}&section=${encodeURIComponent(section)}`
                    : `/school/students/new?class=${classLevel}`
                  : "/school/students/new"
              }
              className={cn(buttonVariants({ size: "sm" }), "h-8 gap-1.5 rounded-lg")}
            >
              <Plus className="size-4" />
              Add students
            </Link>
          </div>
        }
      />
      <SchoolStudentsDrive
        classLevel={classLevel}
        section={section}
        organization={organization}
        students={students}
        schoolPrograms={school.schoolPrograms}
      />
    </>
  );
}
