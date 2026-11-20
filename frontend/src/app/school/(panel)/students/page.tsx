import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { verifySchoolSession } from "@/features/school-auth/session";
import { SchoolStudentsDrive } from "@/features/students/school-students-drive";
import {
  seatsForClass,
  sectionIdsForClass,
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

  const organization = await listSchoolClassOrganization();
  const sectionIds =
    classLevel != null && section
      ? sectionIdsForClass(organization, classLevel, section)
      : undefined;
  // Scope by class/section so large schools are not truncated by the 500-row page size.
  const studentsPage = await listSchoolStudents({
    pageSize: 500,
    status: "ACTIVE",
    ...(classLevel != null ? { classLevel } : {}),
    ...(sectionIds?.length === 1 ? { sectionId: sectionIds[0] } : {}),
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
      ? `${school.name} · students`
      : `${school.name} · all sections`
    : "Open a class to view students";
  const roster =
    inClass && classLevel != null
      ? studentsInClass(students, classLevel, section, { sectionIds })
      : [];
  const seats =
    inClass && classLevel != null ? seatsForClass(organization, classLevel, section) : 0;
  // Badge = students on roster; seats usage stays in the description (one aligned line).
  const headerCount = inClass ? roster.length : students.length;
  const classDescription =
    inClass && seats > 0
      ? `${roster.length} of ${seats} seats used`
      : description;
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
        description={classDescription}
        count={headerCount}
        actions={
          inClass ? (
            <div className="flex flex-wrap items-center gap-2">
              <ClassProfilesPdfActions
                portal="school"
                studentIds={roster.map((student) => student.id)}
                scopeLabel={title}
                schoolName={school.name}
                subjects={classSubjects}
              />
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
          ) : undefined
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
