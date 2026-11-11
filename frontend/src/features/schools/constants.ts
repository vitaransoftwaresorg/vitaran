import type { SchoolBoard, SchoolStatus, SchoolType } from "@/types/school";

export const BOARD_LABELS: Record<SchoolBoard, string> = {
  CBSE: "CBSE",
  ICSE: "ICSE",
  STATE: "State Board",
  IB: "IB",
  IGCSE: "IGCSE",
  OTHER: "Other",
};

export const TYPE_LABELS: Record<SchoolType, string> = {
  REGULAR: "Regular",
  CUSTOMIZED: "Customized",
};

export const STATUS_LABELS: Record<SchoolStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

/** Fallback labels for seeded catalog codes; prefer LearningProgram.name when available. */
export const PROGRAM_LABELS: Record<string, string> = {
  INTEGRATED: "Integrated Program",
  ADVANCED: "Advanced Program",
  REVISED_ADVANCED: "Revised Advanced Program",
  OLYMPIAD: "Olympiad Program",
  OLYMPIAD_PRIMARY: "Olympiad Program Class 1 to 5",
};

/** Same title-casing as the admin programs table. */
function titleCaseWords(value: string) {
  return value.replace(
    /(^|\s)(\p{L})/gu,
    (_match, space: string, letter: string) => space + letter.toUpperCase(),
  );
}

export function programLabel(code: string, name?: string | null) {
  const raw = name?.trim() || PROGRAM_LABELS[code] || code.replaceAll("_", " ");
  return titleCaseWords(raw);
}

/** Customized catalog code this school is enrolled in — never a regular catalog code. */
export function customizedProgramCode(
  school: { type?: string; programs?: string[] } | undefined,
  programs: Array<{ code: string; type?: string }>,
) {
  if (!school || (school.type ?? "REGULAR") !== "CUSTOMIZED") return undefined;
  const custom = new Set(
    programs.filter((program) => (program.type ?? "REGULAR") === "CUSTOMIZED").map((program) => program.code),
  );
  return school.programs?.find((code) => custom.has(code));
}

/** Customized keys show the school / custom program, not Advanced / Integrated / etc. */
export function customizedOwnerLabel(
  owner: {
    type?: string;
    program: string;
    school?: { name?: string } | null;
  },
  catalog?: { type?: string; name?: string | null } | null,
) {
  if ((owner.type ?? "REGULAR") !== "CUSTOMIZED") {
    return programLabel(owner.program, catalog?.name);
  }
  if (catalog && (catalog.type ?? "REGULAR") === "CUSTOMIZED") {
    return programLabel(owner.program, catalog.name);
  }
  return owner.school?.name?.trim() || programLabel(owner.program, catalog?.name);
}

/** One customized catalog program is created per customized school, so skip the extra school folder. */
export function soleSchoolForCustomProgram<
  T extends { id: string; name?: string; type?: string; programs?: string[] },
>(program: { code: string; name?: string | null; type?: string } | undefined, schools: T[]) {
  if (!program || (program.type ?? "REGULAR") !== "CUSTOMIZED") return undefined;
  const enrolled = schools.filter(
    (school) => (school.type ?? "REGULAR") === "CUSTOMIZED" && school.programs?.includes(program.code),
  );
  if (enrolled.length === 1) return enrolled[0];
  const programName = program.name?.trim().toLowerCase();
  if (!programName) return undefined;
  const named = schools.filter(
    (school) =>
      (school.type ?? "REGULAR") === "CUSTOMIZED" && school.name?.trim().toLowerCase() === programName,
  );
  return named.length === 1 ? named[0] : undefined;
}

/**
 * Customized schools that are not already represented by a customized catalog
 * program — the school itself is the custom program.
 */
export function unmatchedCustomizedSchools<
  T extends { id: string; name?: string; type?: string; programs?: string[] },
>(
  programs: Array<{ code: string; name?: string | null; type?: string }>,
  schools: T[],
) {
  const customizedPrograms = programs.filter((program) => (program.type ?? "REGULAR") === "CUSTOMIZED");
  const customCodes = new Set(customizedPrograms.map((program) => program.code));
  const customizedSchools = schools.filter((school) => (school.type ?? "REGULAR") === "CUSTOMIZED");
  const covered = new Set<string>();

  for (const school of customizedSchools) {
    if (school.programs?.some((code) => customCodes.has(code))) covered.add(school.id);
  }
  for (const program of customizedPrograms) {
    const sole = soleSchoolForCustomProgram(program, customizedSchools);
    if (sole) covered.add(sole.id);
  }

  return customizedSchools
    .filter((school) => !covered.has(school.id))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}

export function classLevelsFromProgram(
  program: { classFrom: number; classTo: number } | null | undefined,
) {
  if (!program) return [];
  const from = Math.min(program.classFrom, program.classTo);
  const to = Math.max(program.classFrom, program.classTo);
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

export function uniqueClassLevels(...groups: Array<Iterable<number> | undefined>) {
  const levels = new Set<number>();
  for (const group of groups) {
    if (!group) continue;
    for (const level of group) levels.add(level);
  }
  return [...levels].sort((a, b) => a - b);
}

/** Classes for an answer-key/results folder: catalog range, or a school's enrolled levels. */
export function classLevelsForOwner(
  path: { program?: string; schoolId?: string },
  programs: Array<{ code: string; type?: string; name?: string | null; classFrom: number; classTo: number }>,
  schools: Array<{
    id: string;
    name?: string;
    type?: string;
    programs?: string[];
    offerings?: Array<{ classLevels: number[] }>;
  }>,
  extra: Iterable<number> = [],
) {
  if (path.program) {
    return uniqueClassLevels(
      classLevelsFromProgram(programs.find((row) => row.code === path.program)),
      extra,
    );
  }
  const school = schools.find((row) => row.id === path.schoolId);
  const enrolled = school?.offerings?.flatMap((row) => row.classLevels) ?? [];
  const customCode = customizedProgramCode(school, programs);
  return uniqueClassLevels(
    enrolled.length > 0
      ? enrolled
      : classLevelsFromProgram(
          programs.find((row) => row.code === (customCode ?? school?.programs?.[0])),
        ),
    extra,
  );
}

/** Known labels for seeded subject codes; anything else is title-cased. */
export const SUBJECT_LABELS: Record<string, string> = {
  MATHEMATICS: "Mathematics",
  PHYSICS: "Physics",
  CHEMISTRY: "Chemistry",
  BIOLOGY: "Biology",
  SCIENCE: "Science",
  ENGLISH: "English",
};

/** Same bands as regular catalog: Olympiad Primary 1–5, Advanced/Integrated 6–10. */
const PRIMARY_CLASS_SUBJECTS = ["MATHEMATICS", "SCIENCE"];
const SECONDARY_CLASS_SUBJECTS = ["MATHEMATICS", "PHYSICS", "CHEMISTRY", "BIOLOGY"];

export function subjectsForClassLevel(classLevel: number) {
  return classLevel <= 5 ? PRIMARY_CLASS_SUBJECTS : SECONDARY_CLASS_SUBJECTS;
}

export function subjectLabel(subject: string) {
  if (SUBJECT_LABELS[subject]) return SUBJECT_LABELS[subject];
  return subject
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const SCHOOLS_PAGE_SIZE = 10;
