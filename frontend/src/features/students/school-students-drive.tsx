"use client";

import { DriveBrowser, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
import { programLabel } from "@/features/schools/constants";
import { displaySectionName } from "@/features/schools/section-label";
import { subjectsForSchoolClass } from "@/features/students/report-subjects";
import {
  seatsForClass,
  sectionIdsForClass,
  studentsInClass,
} from "@/features/students/school-roster";
import { ListPagination } from "@/components/shared/list-pagination";
import { StudentsTable } from "@/features/students/students-table";
import type { ClassOrganization } from "@/types/section";
import type { SchoolProgramOffering } from "@/types/program";
import type { Pagination } from "@/types/school";
import type { Student } from "@/types/student";

export const SCHOOL_STUDENTS_PATH = "/school/students";

type SchoolStudentsDriveProps = {
  classLevel?: number;
  /** Optional filter when opening a single section; class view shows both. */
  section?: string;
  organization?: ClassOrganization | null;
  students?: Student[];
  schoolPrograms?: SchoolProgramOffering[];
  pagination?: Pagination;
  listParams?: Record<string, string | number | undefined | null>;
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

function sectionHref(classLevel: number, section: string) {
  return `${SCHOOL_STUDENTS_PATH}?${new URLSearchParams({
    class: String(classLevel),
    section: displaySectionName(section),
  })}`;
}

/** Named sections for a class from school setup (for section-wise roster / delete). */
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

function emptyRosterMessage(section: string | undefined, seats: number, classCount = 0) {
  if (section && classCount > 0) {
    return `No students in section ${section}. ${classCount} student${classCount === 1 ? " is" : "s are"} in this class under another section — open the class (without a section filter) to see them.`;
  }
  if (seats > 0) {
    return section
      ? `Seat limit ${seats} — roster is empty. Add students here (Results uses this same roster).`
      : `Seat limit ${seats} — roster is empty. Add students to fill Results.`;
  }
  return section
    ? "No students in this class section yet."
    : "No students in this class yet.";
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

  const levelsWithSections = new Set(
    (organization?.sections ?? []).map((section) => section.classLevel),
  );

  // Class total seats = sum of section seats (skip whole-class when sections exist).
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

  // Counts come from the same school roster the table uses.
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

export function SchoolStudentsDrive({
  classLevel,
  section,
  organization,
  students = [],
  schoolPrograms,
  pagination,
  listParams,
}: SchoolStudentsDriveProps) {
  // Class open, no section yet, and class has sections → pick a section (delete students section-wise).
  if (classLevel != null && !section) {
    const sectionFolders = sectionsForClass(organization, classLevel);
    if (sectionFolders.length > 0) {
      const breadcrumbs: DriveCrumb[] = [
        { label: "Students", href: SCHOOL_STUDENTS_PATH },
        { label: `Class ${classLevel}`, href: classHref(classLevel) },
      ];
      const items: DriveItem[] = sectionFolders.map((folder) => {
        const roster = studentsInClass(students, classLevel, folder.label, {
          sectionIds: folder.sectionId ? [folder.sectionId] : undefined,
        });
        const seatsDetail = folder.seats > 0 ? `${folder.seats} seat limit` : null;
        const rosterDetail =
          roster.length > 0 ? `${roster.length} on roster` : null;
        return {
          id: folder.sectionId ?? `${classLevel}-${folder.label}`,
          name: `Section ${folder.label}`,
          kind: "folder" as const,
          href: sectionHref(classLevel, folder.label),
          detail: [rosterDetail, seatsDetail].filter(Boolean).join(" · ") || "Empty",
        };
      });
      return (
        <DriveBrowser
          key={`class:${classLevel}`}
          breadcrumbs={breadcrumbs}
          items={items}
          emptyText="No sections set up for this class"
          searchPlaceholder="Search sections"
        />
      );
    }
  }

  if (classLevel != null) {
    const sectionIds = sectionIdsForClass(organization, classLevel, section);
    const roster = studentsInClass(students, classLevel, section, { sectionIds });
    const seats = seatsForClass(organization, classLevel, section);
    const classCount = pagination?.total ?? studentsInClass(students, classLevel).length;
    return (
      <StudentsTable
        students={roster}
        mode="school"
        baseHref={SCHOOL_STUDENTS_PATH}
        seats={seats}
        subjects={subjectsForSchoolClass(schoolPrograms, classLevel, roster[0]?.programId)}
        emptyMessage={emptyRosterMessage(section, seats, classCount)}
        scopeKey={`school:${classLevel}:${section ?? ""}`}
        pagination={
          pagination ? (
            <ListPagination
              pagination={pagination}
              basePath={SCHOOL_STUDENTS_PATH}
              searchParams={{ class: classLevel, section, ...listParams }}
              noun="students"
              pageSizeOptions={[10, 20, 50, 100]}
            />
          ) : undefined
        }
      />
    );
  }

  const folders = classFoldersForSchool(organization, students);
  const breadcrumbs: DriveCrumb[] = [{ label: "Students", href: SCHOOL_STUDENTS_PATH }];

  const items: DriveItem[] = folders.map((folder) => {
    const programDetail = folder.programs.map((name) => programLabel(name, name)).join(", ");
    const sectionDetail =
      folder.sections.length > 0
        ? `${folder.sections.length} section${folder.sections.length === 1 ? "" : "s"}`
        : null;
    const seatsDetail = folder.seats > 0 ? `${folder.seats} seat limit` : null;
    const rosterDetail =
      folder.studentCount > 0 ? `${folder.studentCount} on roster` : null;
    const countDetail = [rosterDetail, seatsDetail].filter(Boolean).join(" · ") || "Empty";
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
      key="classes"
      breadcrumbs={breadcrumbs}
      items={items}
      emptyText="No classes set up yet"
      searchPlaceholder="Search classes"
    />
  );
}
