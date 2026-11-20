"use client";

import { DriveBrowser, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
import { programLabel } from "@/features/schools/constants";
import { displaySectionName } from "@/features/schools/section-label";
import { subjectsForSchoolClass } from "@/features/students/report-subjects";
import { StudentsTable } from "@/features/students/students-table";
import type { ClassOrganization } from "@/types/section";
import type { SchoolProgramOffering } from "@/types/program";
import type { Student } from "@/types/student";

export const SCHOOL_STUDENTS_PATH = "/school/students";

type SchoolStudentsDriveProps = {
  classLevel?: number;
  /** Optional filter when opening a single section; class view shows both. */
  section?: string;
  organization?: ClassOrganization | null;
  students?: Student[];
  schoolPrograms?: SchoolProgramOffering[];
};

type ClassFolder = {
  key: string;
  classLevel: number;
  sections: string[];
  programs: string[];
  seats: number;
  studentCount: number;
};

function classHref(classLevel: number) {
  return `${SCHOOL_STUDENTS_PATH}?${new URLSearchParams({ class: String(classLevel) })}`;
}

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

  // Folders follow Classes & sections only — not orphan student rows.
  for (const row of organization?.wholeClasses ?? []) {
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

  const orgClassLevels = new Set(folders.keys());
  for (const student of students) {
    if (!orgClassLevels.has(student.classLevel)) continue;
    const folder = folders.get(student.classLevel);
    if (!folder) continue;
    folder.studentCount += 1;
  }

  return [...folders.values()]
    .map((folder) => ({
      ...folder,
      sections: [...folder.sections].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.classLevel - b.classLevel);
}

function studentsInClass(students: Student[], classLevel: number, section?: string) {
  return students
    .filter((student) => {
      if (student.classLevel !== classLevel) return false;
      if (!section) return true;
      return displaySectionName(student.sectionName) === section;
    })
    .sort(
      (a, b) =>
        displaySectionName(a.sectionName).localeCompare(displaySectionName(b.sectionName)) ||
        a.rollNo.localeCompare(b.rollNo),
    );
}

export function SchoolStudentsDrive({
  classLevel,
  section,
  organization,
  students = [],
  schoolPrograms,
}: SchoolStudentsDriveProps) {
  if (classLevel != null) {
    const roster = studentsInClass(students, classLevel, section);
    return (
      <StudentsTable
        students={roster}
        mode="school"
        baseHref={SCHOOL_STUDENTS_PATH}
        subjects={subjectsForSchoolClass(schoolPrograms, classLevel, roster[0]?.programId)}
        emptyMessage={
          section
            ? "No students in this class section yet."
            : "No students in this class yet."
        }
      />
    );
  }

  const folders = classFoldersForSchool(organization, students);
  const breadcrumbs: DriveCrumb[] = [{ label: "Students", href: SCHOOL_STUDENTS_PATH }];

  const items: DriveItem[] = folders.map((folder) => {
    const programDetail = folder.programs.map((name) => programLabel(name, name)).join(", ");
    const sectionDetail =
      folder.sections.length > 0 ? `Sections ${folder.sections.join(", ")}` : null;
    const countDetail =
      folder.studentCount > 0
        ? `${folder.studentCount} student${folder.studentCount === 1 ? "" : "s"}`
        : folder.seats > 0
          ? `${folder.seats} seats`
          : "Empty";
    return {
      id: folder.key,
      name: `Class ${folder.classLevel}`,
      kind: "folder" as const,
      href: classHref(folder.classLevel),
      detail: [programDetail, sectionDetail, countDetail].filter(Boolean).join(" · "),
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
