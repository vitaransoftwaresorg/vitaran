"use client";

import { useEffect } from "react";
import { useSetDrivePathCrumbs } from "@/components/layout/drive-path-context";
import { DriveBrowser, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
import { programLabel, subjectsForClassLevel, TYPE_LABELS } from "@/features/schools/constants";
import { displaySectionName } from "@/features/schools/section-label";
import {
  STUDENTS_PATH,
  sectionIdsForClass,
  studentsInClass,
} from "@/features/students/school-roster";
import { ListPagination } from "@/components/shared/list-pagination";
import { StudentsTable } from "@/features/students/students-table";
import type { ClassOrganization } from "@/types/section";
import type { Pagination, SchoolOption } from "@/types/school";
import type { Student } from "@/types/student";

type StudentsDriveProps = {
  schools: SchoolOption[];
  schoolId?: string;
  classLevel?: number;
  /** Optional single-section filter; class view shows both sections. */
  section?: string;
  organization?: ClassOrganization | null;
  /** When a school is open: roster page for that school. */
  students?: Student[];
  pagination?: Pagination;
  listParams?: Record<string, string | number | undefined | null>;
  /**
   * Opened from a school profile (`?from=school`).
   * Otherwise treated as opened from the Students page.
   */
  fromSchool?: boolean;
};

function studentsQuery(
  schoolId: string,
  opts?: { classLevel?: number; section?: string; fromSchool?: boolean },
) {
  const params = new URLSearchParams({ school: schoolId });
  if (opts?.classLevel != null) params.set("class", String(opts.classLevel));
  if (opts?.section) params.set("section", displaySectionName(opts.section));
  if (opts?.fromSchool) params.set("from", "school");
  return `${STUDENTS_PATH}?${params}`;
}

function schoolHref(schoolId: string, fromSchool?: boolean) {
  return studentsQuery(schoolId, { fromSchool });
}

function classHref(schoolId: string, classLevel: number, fromSchool?: boolean) {
  return studentsQuery(schoolId, { classLevel, fromSchool });
}

function sectionHref(
  schoolId: string,
  classLevel: number,
  section: string,
  fromSchool?: boolean,
) {
  return studentsQuery(schoolId, { classLevel, section, fromSchool });
}

function sectionsForClass(
  organization: ClassOrganization | null | undefined,
  classLevel: number,
) {
  const rows = (organization?.sections ?? []).filter((row) => row.classLevel === classLevel);
  const labels = [
    ...new Set(rows.map((row) => displaySectionName(row.name)).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  return labels.map((label) => {
    const match = rows.find((row) => displaySectionName(row.name) === label);
    return { label, sectionId: match?.id ?? null, seats: match?.studentCount ?? 0 };
  });
}

function emptyRosterMessage(section: string | undefined, classCount = 0) {
  if (section && classCount > 0) {
    return `No students in section ${section}. ${classCount} student${classCount === 1 ? " is" : "s are"} in this class under another section — open the class (without a section filter) to see them.`;
  }
  return section
    ? "No students in this class section yet. Add students here (Results uses this same list)."
    : "No students in this class yet. Add students to fill Results.";
}

type ClassFolder = {
  key: string;
  classLevel: number;
  sections: string[];
  programs: string[];
  seats: number;
  studentCount: number;
};

function classFoldersForSchool(
  organization: ClassOrganization | null | undefined,
  students: Student[],
): ClassFolder[] {
  const folders = new Map<number, ClassFolder>();

  const ensure = (classLevel: number) => {
    const existing = folders.get(classLevel);
    if (existing) return existing;
    const created: ClassFolder = {
      key: String(classLevel),
      classLevel,
      sections: [],
      programs: [],
      seats: 0,
      studentCount: 0,
    };
    folders.set(classLevel, created);
    return created;
  };

  const addSection = (folder: ClassFolder, section: string) => {
    if (!folder.sections.includes(section)) folder.sections.push(section);
  };
  const addProgram = (folder: ClassFolder, programName: string) => {
    if (!folder.programs.includes(programName)) folder.programs.push(programName);
  };

  const levelsWithSections = new Set(
    (organization?.sections ?? []).map((section) => section.classLevel),
  );

  // Class total seats = sum of its sections (or whole-class seats when there are no sections).
  for (const row of organization?.wholeClasses ?? []) {
    if (levelsWithSections.has(row.classLevel)) continue;
    const folder = ensure(row.classLevel);
    folder.seats += row.studentCount;
    addSection(folder, "A");
    addProgram(folder, row.programName);
  }
  for (const section of organization?.sections ?? []) {
    const folder = ensure(section.classLevel);
    folder.seats += section.studentCount;
    addSection(folder, section.name);
    addProgram(folder, section.programName);
  }

  for (const student of students) {
    const folder = ensure(student.classLevel);
    folder.studentCount += 1;
    addSection(folder, displaySectionName(student.sectionName));
    addProgram(folder, student.programName);
  }

  return [...folders.values()]
    .map((folder) => ({
      ...folder,
      sections: [...folder.sections].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.classLevel - b.classLevel);
}

export function StudentsDrive({
  schools,
  schoolId,
  classLevel,
  section,
  organization,
  students = [],
  pagination,
  listParams,
  fromSchool = false,
}: StudentsDriveProps) {
  const school = schools.find((item) => item.id === schoolId);
  const setDrivePath = useSetDrivePathCrumbs();

  useEffect(() => {
    if (!setDrivePath) return;
    if (schoolId && school) {
      const schoolStudentsHref = schoolHref(school.id, fromSchool);
      // Students page: stay in Students drive. School page: School profile › Students.
      const crumbs: DriveCrumb[] = fromSchool
        ? [
            { label: school.name, href: `/admin/schools/${school.id}` },
            { label: "Students", href: schoolStudentsHref },
          ]
        : [{ label: school.name, href: schoolStudentsHref }];
      if (classLevel != null) {
        crumbs.push({
          label: `Class ${classLevel}`,
          href: classHref(school.id, classLevel, fromSchool),
        });
        if (section) {
          crumbs.push({
            label: `Section ${displaySectionName(section)}`,
            href: sectionHref(school.id, classLevel, section, fromSchool),
          });
        }
      }
      setDrivePath(crumbs);
      return () => setDrivePath([]);
    }
    setDrivePath([]);
  }, [school, schoolId, classLevel, section, fromSchool, setDrivePath]);

  if (schoolId && school && classLevel != null && !section) {
    const sectionFolders = sectionsForClass(organization, classLevel);
    if (sectionFolders.length > 0) {
      const breadcrumbs: DriveCrumb[] = fromSchool
        ? [
            { label: school.name, href: `/admin/schools/${school.id}` },
            { label: "Students", href: schoolHref(school.id, true) },
            { label: `Class ${classLevel}`, href: classHref(school.id, classLevel, true) },
          ]
        : [
            { label: "Students", href: STUDENTS_PATH },
            { label: school.name, href: schoolHref(school.id) },
            { label: `Class ${classLevel}`, href: classHref(school.id, classLevel) },
          ];
      const items: DriveItem[] = sectionFolders.map((folder) => {
        const roster = studentsInClass(students, classLevel, folder.label, {
          sectionIds: folder.sectionId ? [folder.sectionId] : undefined,
        });
        const rosterDetail =
          roster.length > 0 ? `${roster.length} students` : null;
        return {
          id: folder.sectionId ?? `${classLevel}-${folder.label}`,
          name: `Section ${folder.label}`,
          kind: "folder" as const,
          href: sectionHref(school.id, classLevel, folder.label, fromSchool),
          detail: rosterDetail || "Empty",
        };
      });
      return (
        <DriveBrowser
          key={`school:${school.id}:class:${classLevel}:from=${fromSchool ? "school" : "students"}`}
          breadcrumbs={breadcrumbs}
          items={items}
          emptyText="No sections set up for this class"
          searchPlaceholder="Search sections"
        />
      );
    }
  }

  if (schoolId && school && classLevel != null) {
    const sectionIds = sectionIdsForClass(organization, classLevel, section);
    const roster = studentsInClass(students, classLevel, section, { sectionIds });
    const classCount = pagination?.total ?? studentsInClass(students, classLevel).length;

    return (
      <StudentsTable
        students={roster}
        mode="admin"
        subjects={subjectsForClassLevel(classLevel)}
        emptyMessage={emptyRosterMessage(section, classCount)}
        scopeKey={`admin:${school.id}:${classLevel}:${section ?? ""}:${fromSchool ? "s" : "d"}`}
        pagination={
          pagination ? (
            <ListPagination
              pagination={pagination}
              basePath={STUDENTS_PATH}
              searchParams={{
                school: school.id,
                class: classLevel,
                section,
                ...(fromSchool ? { from: "school" } : {}),
                ...listParams,
              }}
              noun="students"
              pageSizeOptions={[10, 20, 50, 100]}
            />
          ) : undefined
        }
      />
    );
  }

  if (schoolId && school) {
    const folders = classFoldersForSchool(organization, students);
    const breadcrumbs: DriveCrumb[] = fromSchool
      ? [
          { label: school.name, href: `/admin/schools/${school.id}` },
          { label: "Students", href: schoolHref(school.id, true) },
        ]
      : [
          { label: "Students", href: STUDENTS_PATH },
          { label: school.name, href: schoolHref(school.id) },
        ];

    const items: DriveItem[] = folders.map((folder) => {
      const programDetail = folder.programs.map((name) => programLabel(name, name)).join(", ");
      const sectionDetail =
        folder.sections.length > 0
          ? `${folder.sections.length} section${folder.sections.length === 1 ? "" : "s"}`
          : null;
      const rosterDetail =
        folder.studentCount > 0
          ? `${folder.studentCount} students`
          : null;
      const countDetail = rosterDetail || "Empty";
      return {
        id: folder.key,
        name: `Class ${folder.classLevel}`,
        kind: "folder" as const,
        href: classHref(school.id, folder.classLevel, fromSchool),
        detail: [programDetail, sectionDetail, countDetail].filter(Boolean).join(" · "),
      };
    });

    return (
      <DriveBrowser
        key={`school:${school.id}:from=${fromSchool ? "school" : "students"}`}
        breadcrumbs={breadcrumbs}
        items={items}
        emptyText="No classes set up yet"
        searchPlaceholder="Search classes"
      />
    );
  }

  const items: DriveItem[] = [...schools]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({
      id: item.id,
      name: item.name,
      kind: "folder" as const,
      href: schoolHref(item.id),
      detail: TYPE_LABELS[item.type],
      imageSrc: item.hasLogo ? `/admin/schools/${item.id}/logo` : undefined,
      nameLogo: true,
    }));

  return (
    <DriveBrowser
      key="schools"
      breadcrumbs={[{ label: "Students", href: STUDENTS_PATH }]}
      items={items}
      emptyText="No schools yet"
      searchPlaceholder="Search schools"
    />
  );
}
