"use client";

import { DriveBrowser, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
import { programLabel } from "@/features/schools/constants";
import { displaySectionName } from "@/features/schools/section-label";
import { StudentsTable } from "@/features/students/students-table";
import type { ClassOrganization } from "@/types/section";
import type { Student } from "@/types/student";

export const SCHOOL_STUDENTS_PATH = "/school/students";

type SchoolStudentsDriveProps = {
  classLevel?: number;
  section?: string;
  organization?: ClassOrganization | null;
  students?: Student[];
};

type ClassFolder = {
  key: string;
  classLevel: number;
  section: string;
  programs: string[];
  seats: number;
  studentCount: number;
};

function classHref(classLevel: number, section: string) {
  return `${SCHOOL_STUDENTS_PATH}?${new URLSearchParams({
    class: String(classLevel),
    section,
  })}`;
}

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

export function SchoolStudentsDrive({
  classLevel,
  section,
  organization,
  students = [],
}: SchoolStudentsDriveProps) {
  if (classLevel != null && section) {
    const roster = studentsInClassSection(students, classLevel, section);
    return (
      <StudentsTable
        students={roster}
        mode="school"
        baseHref={SCHOOL_STUDENTS_PATH}
        emptyMessage="No students in this class section yet."
      />
    );
  }

  const folders = classFoldersForSchool(organization, students);
  const breadcrumbs: DriveCrumb[] = [{ label: "Students", href: SCHOOL_STUDENTS_PATH }];

  const items: DriveItem[] = folders.map((folder) => {
    const programDetail = folder.programs.map((name) => programLabel(name, name)).join(", ");
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
      href: classHref(folder.classLevel, folder.section),
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
