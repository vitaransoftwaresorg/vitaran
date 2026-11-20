import type { ClassOrganization } from "@/types/section";

export type AddStudentsDefaults = {
  programId?: string;
  classLevel?: number;
  sectionId?: string | null;
};

export type AddStudentsPlacement = {
  classLevel?: number;
  sectionName?: string;
  defaults?: AddStudentsDefaults;
  lockPlacement: boolean;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * One Add students flow for admin and school.
 * Same placement rules, same BulkStudentForm — only return URL / submit action differ.
 */
export function resolveAddStudentsPlacement(
  organization: ClassOrganization,
  searchParams: Record<string, string | string[] | undefined>,
): AddStudentsPlacement {
  const classLevelRaw = Number(first(searchParams.class));
  const classLevel =
    Number.isInteger(classLevelRaw) && classLevelRaw >= 1 && classLevelRaw <= 12
      ? classLevelRaw
      : undefined;
  const sectionName = first(searchParams.section)?.trim().toUpperCase() || undefined;

  const matchingSection =
    classLevel != null && sectionName
      ? organization.sections.find(
          (section) =>
            section.classLevel === classLevel &&
            section.name.trim().toUpperCase() === sectionName,
        )
      : undefined;

  const classSections =
    classLevel != null
      ? organization.sections.filter((section) => section.classLevel === classLevel)
      : [];
  const classWhole =
    classLevel != null
      ? organization.wholeClasses.find((row) => row.classLevel === classLevel)
      : undefined;

  const wholeOnly =
    classLevel != null && classSections.length === 0 && Boolean(classWhole);

  // Class open with sections but no section in the URL → lock to the first section (no picker on the form).
  const defaultClassSection = classSections[0];

  const defaults: AddStudentsDefaults | undefined = matchingSection
    ? {
        programId: matchingSection.programId,
        classLevel: matchingSection.classLevel,
        sectionId: matchingSection.id,
      }
    : wholeOnly && classWhole
      ? {
          programId: classWhole.programId,
          classLevel: classWhole.classLevel,
          sectionId: null,
        }
      : classLevel != null && defaultClassSection
        ? {
            programId: defaultClassSection.programId,
            classLevel,
            sectionId: defaultClassSection.id,
          }
        : classLevel != null && classWhole
          ? {
              programId: classWhole.programId,
              classLevel: classWhole.classLevel,
              sectionId: null,
            }
          : undefined;

  return {
    classLevel,
    // Keep the URL section only (for return path / page title). Class-level open may still
    // lock defaults.sectionId to the first section without rewriting the return URL.
    sectionName,
    defaults,
    // Opened from Students (class/section) — program / class / section are fixed; no pickers.
    lockPlacement: Boolean(defaults?.programId && defaults.classLevel != null),
  };
}

export function addStudentsDescription(
  schoolName: string,
  classLevel?: number,
  sectionName?: string,
) {
  if (classLevel == null) return schoolName;
  if (sectionName) return `${schoolName} · Class ${classLevel}-${sectionName}`;
  return `${schoolName} · Class ${classLevel}`;
}

export function schoolAddStudentsReturnTo(classLevel?: number, sectionName?: string) {
  if (classLevel == null) return "/school/students";
  if (sectionName) {
    return `/school/students?class=${classLevel}&section=${encodeURIComponent(sectionName)}`;
  }
  return `/school/students?class=${classLevel}`;
}

export function adminAddStudentsReturnTo(
  schoolId: string,
  classLevel?: number,
  sectionName?: string,
) {
  if (classLevel == null) return `/admin/schools/students?school=${schoolId}`;
  if (sectionName) {
    return `/admin/schools/students?school=${schoolId}&class=${classLevel}&section=${encodeURIComponent(sectionName)}`;
  }
  return `/admin/schools/students?school=${schoolId}&class=${classLevel}`;
}
