"use client";

import { DriveBrowser, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
import { programLabel, TYPE_LABELS } from "@/features/schools/constants";
import { displaySectionName } from "@/features/schools/section-label";
import { STUDENTS_PATH, studentsForSchoolOfferings } from "@/features/students/school-roster";
import { StudentsTable } from "@/features/students/students-table";
import type { ClassOrganization } from "@/types/section";
import type { SchoolOption } from "@/types/school";
import type { Student } from "@/types/student";

type StudentsDriveProps = {
  schools: SchoolOption[];
  schoolId?: string;
  classLevel?: number;
  section?: string;
  organization?: ClassOrganization | null;
  /** When a school is open: full roster for that school. */
  students?: Student[];
};

function schoolHref(schoolId: string) {
  return `${STUDENTS_PATH}?${new URLSearchParams({ school: schoolId })}`;
}

function classHref(schoolId: string, classLevel: number, section: string) {
  return `${STUDENTS_PATH}?${new URLSearchParams({
    school: schoolId,
    class: String(classLevel),
    section,
  })}`;
}

type ClassFolder = {
  key: string;
  classLevel: number;
  section: string;
  programs: string[];
  seats: number;
  studentCount: number;
};

function classFoldersForSchool(
  organization: ClassOrganization | null | undefined,
  students: Student[],
): ClassFolder[] {
  const folders = new Map<string, ClassFolder>();

  const ensure = (classLevel: number, section: string) => {
    const key = `${classLevel}:${section}`;
    const existing = folders.get(key);
    if (existing) return existing;
    const created: ClassFolder = {
      key,
      classLevel,
      section,
      programs: [],
      seats: 0,
      studentCount: 0,
    };
    folders.set(key, created);
    return created;
  };

  for (const row of organization?.wholeClasses ?? []) {
    const folder = ensure(row.classLevel, "A");
    folder.seats = Math.max(folder.seats, row.studentCount);
    if (!folder.programs.includes(row.programName)) folder.programs.push(row.programName);
  }
  for (const section of organization?.sections ?? []) {
    const folder = ensure(section.classLevel, section.name);
    folder.seats = Math.max(folder.seats, section.studentCount);
    if (!folder.programs.includes(section.programName)) folder.programs.push(section.programName);
  }

  for (const student of students) {
    const folder = ensure(student.classLevel, displaySectionName(student.sectionName));
    folder.studentCount += 1;
    if (!folder.programs.includes(student.programName)) folder.programs.push(student.programName);
  }

  return [...folders.values()].sort(
    (a, b) => a.classLevel - b.classLevel || a.section.localeCompare(b.section),
  );
}

function studentsInClassSection(students: Student[], classLevel: number, section: string) {
  return students
    .filter(
      (student) =>
        student.classLevel === classLevel && displaySectionName(student.sectionName) === section,
    )
    .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
}

export function StudentsDrive({
  schools,
  schoolId,
  classLevel,
  section,
  organization,
  students = [],
}: StudentsDriveProps) {
  const school = schools.find((item) => item.id === schoolId);

  if (schoolId && school && classLevel != null && section) {
    const roster = studentsInClassSection(
      studentsForSchoolOfferings(school, students),
      classLevel,
      section,
    );

    return (
      <StudentsTable
        students={roster}
        mode="admin"
        emptyMessage="No students in this class section yet."
      />
    );
  }

  if (schoolId && school) {
    const roster = studentsForSchoolOfferings(school, students);
    const folders = classFoldersForSchool(organization, roster);
    const breadcrumbs: DriveCrumb[] = [
      { label: "Students", href: STUDENTS_PATH },
      { label: school.name, href: schoolHref(school.id) },
    ];

    const items: DriveItem[] = folders.map((folder) => {
      const programDetail = folder.programs
        .map((name) => programLabel(name, name))
        .join(", ");
      const countDetail =
        folder.studentCount > 0
          ? `${folder.studentCount} student${folder.studentCount === 1 ? "" : "s"}`
          : folder.seats > 0
            ? `${folder.seats} seats`
            : "Empty";
      return {
        id: folder.key,
        name: `Class ${folder.classLevel}-${folder.section}`,
        kind: "folder" as const,
        href: classHref(school.id, folder.classLevel, folder.section),
        detail: [programDetail, countDetail].filter(Boolean).join(" · "),
      };
    });

    return (
      <DriveBrowser
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
    }));

  return (
    <DriveBrowser
      breadcrumbs={[{ label: "Students", href: STUDENTS_PATH }]}
      items={items}
      emptyText="No schools yet"
      searchPlaceholder="Search schools"
    />
  );
}
