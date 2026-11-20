"use client";

import { useEffect } from "react";
import { useSetDrivePathCrumbs } from "@/components/layout/drive-path-context";
import { DriveBrowser, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
import { programLabel, subjectsForClassLevel, TYPE_LABELS } from "@/features/schools/constants";
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
  /** Optional single-section filter; class view shows both sections. */
  section?: string;
  organization?: ClassOrganization | null;
  /** When a school is open: full roster for that school. */
  students?: Student[];
};

function schoolHref(schoolId: string) {
  return `${STUDENTS_PATH}?${new URLSearchParams({ school: schoolId })}`;
}

function classHref(schoolId: string, classLevel: number) {
  return `${STUDENTS_PATH}?${new URLSearchParams({
    school: schoolId,
    class: String(classLevel),
  })}`;
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

export function StudentsDrive({
  schools,
  schoolId,
  classLevel,
  section,
  organization,
  students = [],
}: StudentsDriveProps) {
  const school = schools.find((item) => item.id === schoolId);
  const setDrivePath = useSetDrivePathCrumbs();

  useEffect(() => {
    if (!setDrivePath) return;
    if (schoolId && school && classLevel != null) {
      const classLabel = section
        ? `Class ${classLevel}-${section} students`
        : `Class ${classLevel} students`;
      setDrivePath([
        { label: school.name, href: schoolHref(school.id) },
        { label: classLabel, href: classHref(school.id, classLevel) },
      ]);
      return () => setDrivePath([]);
    }
    if (!(schoolId && school)) {
      setDrivePath([]);
    }
  }, [school, schoolId, classLevel, section, setDrivePath]);

  if (schoolId && school && classLevel != null) {
    const roster = studentsInClass(
      studentsForSchoolOfferings(school, students),
      classLevel,
      section,
    );

    return (
      <StudentsTable
        students={roster}
        mode="admin"
        subjects={subjectsForClassLevel(classLevel)}
        emptyMessage={
          section ? "No students in this class section yet." : "No students in this class yet."
        }
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
        href: classHref(school.id, folder.classLevel),
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
