import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import {
  DEFAULT_STUDENTS_PAGE_SIZE,
  parseListPage,
  parseListPageSize,
} from "@/features/list/page-params";
import { AdminStudentsPageActions } from "@/features/students/admin-students-page-actions";
import { StudentsDrive } from "@/features/students/students-drive";
import { sectionIdsForClass, studentsInClass } from "@/features/students/school-roster";
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
  const fromSchool = first(query.from)?.trim().toLowerCase() === "school";
  const page = parseListPage(query.page);
  const pageSize = parseListPageSize(query.pageSize, DEFAULT_STUDENTS_PAGE_SIZE, 100);

  const schools = await listSchoolOptions();
  const school = schoolId ? schools.find((item) => item.id === schoolId) : undefined;

  const organization = school ? await listAdminSchoolSections(school.id) : null;
  const sectionIds =
    school && classLevel != null && section
      ? sectionIdsForClass(organization, classLevel, section)
      : undefined;
  const hasSections =
    classLevel != null &&
    (organization?.sections ?? []).some((row) => row.classLevel === classLevel);
  const showRosterTable = Boolean(school && classLevel != null && (section || !hasSections));

  const studentsPage = school
    ? await listAdminSchoolStudents(school.id, {
        status: "ACTIVE",
        ...(classLevel != null ? { classLevel } : {}),
        ...(sectionIds?.length === 1 ? { sectionId: sectionIds[0] } : {}),
        ...(showRosterTable
          ? { page, pageSize }
          : { pageSize: 500 }),
      })
    : null;
  const students = studentsPage?.items ?? [];

  const inClass = Boolean(school && classLevel != null);
  const classScopeLabel =
    inClass && classLevel != null
      ? section
        ? `Class ${classLevel}-${section}`
        : `Class ${classLevel} students`
      : undefined;
  const description = school
    ? inClass
      ? undefined
      : "Open a class to view students"
    : "Open a school to view its classes";
  const roster =
    inClass && classLevel != null
      ? studentsInClass(students, classLevel, section, { sectionIds })
      : [];
  return (
    <>
      <PageHeader
        title={school ? undefined : "Students"}
        description={description}
        count={school ? undefined : schools.length}
        actions={
          <AdminStudentsPageActions
            schoolId={school?.id}
            schoolName={school?.name}
            classLevel={classLevel}
            section={section}
            inClass={inClass}
            classScopeLabel={classScopeLabel}
            studentIds={roster.map((student) => student.id)}
            canDeleteRoster={Boolean(
              school &&
                inClass &&
                classLevel != null &&
                (section ||
                  !(organization?.sections ?? []).some((row) => row.classLevel === classLevel)),
            )}
            sectionId={sectionIds?.length === 1 ? sectionIds[0] : null}
            studentCount={
              showRosterTable ? (studentsPage?.pagination.total ?? roster.length) : roster.length
            }
            showImportAll={Boolean(school && !inClass)}
            addStudentsHref={
              school && inClass && classLevel != null
                ? section
                  ? `/admin/schools/${school.id}/students/new?class=${classLevel}&section=${encodeURIComponent(section)}`
                  : `/admin/schools/${school.id}/students/new?class=${classLevel}`
                : undefined
            }
          />
        }
      />
      <StudentsDrive
        schools={schools}
        schoolId={school?.id}
        classLevel={classLevel}
        section={section}
        organization={organization}
        students={students}
        pagination={showRosterTable ? studentsPage?.pagination : undefined}
        fromSchool={fromSchool}
        listParams={{
          pageSize: pageSize === DEFAULT_STUDENTS_PAGE_SIZE ? undefined : pageSize,
        }}
      />
    </>
  );
}
