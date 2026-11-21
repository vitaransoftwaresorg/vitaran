import type { LearningProgram, SchoolProgramOffering } from "@/types/program";
import type { SchoolProgramInput, SchoolType, Subject } from "@/types/school";
import { subjectsForClassLevel } from "./constants";

/** Placeholder program id for customized schools before Save creates the catalog row. */
export const CUSTOM_DRAFT_PROGRAM_ID = "__custom_draft__";

/** Encodes one class+subject pick: `programId:classLevel:SUBJECT`. */
export function encodeOffering(programId: string, classLevel: number, subject: Subject) {
  return `${programId}:${classLevel}:${subject}`;
}

export function parseOfferingToken(token: string) {
  const [programId, classLevelRaw, subject] = token.split(":");
  const classLevel = Number(classLevelRaw);
  if (!programId || !Number.isInteger(classLevel) || !subject) return null;
  return { programId, classLevel, subject: subject as Subject };
}

export function offeringsToPrograms(tokens: string[]): SchoolProgramInput[] {
  const byProgram = new Map<string, Map<number, Set<Subject>>>();

  for (const token of tokens) {
    const parsed = parseOfferingToken(token);
    if (!parsed) continue;
    const classes = byProgram.get(parsed.programId) ?? new Map<number, Set<Subject>>();
    const subjects = classes.get(parsed.classLevel) ?? new Set<Subject>();
    subjects.add(parsed.subject);
    classes.set(parsed.classLevel, subjects);
    byProgram.set(parsed.programId, classes);
  }

  return [...byProgram.entries()].map(([programId, classes]) => ({
    programId,
    classes: [...classes.entries()]
      .map(([classLevel, subjects]) => ({ classLevel, subjects: [...subjects] }))
      .sort((a, b) => a.classLevel - b.classLevel),
  }));
}

export function schoolProgramsToTokens(offerings: SchoolProgramOffering[]): string[] {
  return offerings.flatMap((program) =>
    program.classes.flatMap((row) =>
      row.subjects.map((subject) => encodeOffering(program.programId, row.classLevel, subject)),
    ),
  );
}

export function uniqueSubjectsFromOfferings(offerings: SchoolProgramOffering[]): Subject[] {
  const subjects = new Set<Subject>();
  for (const program of offerings) {
    for (const row of program.classes) {
      for (const subject of row.subjects) subjects.add(subject);
    }
  }
  return [...subjects];
}

/** Rewrite offering tokens onto one program (e.g. Regular → Customized). */
export function remapOfferingsToProgram(tokens: string[], programId: string): string[] {
  const byClass = new Map<number, Set<Subject>>();
  for (const token of tokens) {
    const parsed = parseOfferingToken(token);
    if (!parsed) continue;
    const subjects = byClass.get(parsed.classLevel) ?? new Set<Subject>();
    subjects.add(parsed.subject);
    byClass.set(parsed.classLevel, subjects);
  }
  return [...byClass.entries()].flatMap(([classLevel, subjects]) =>
    [...subjects].map((subject) => encodeOffering(programId, classLevel, subject)),
  );
}

/** Replace subject access tokens for one program + class level. */
export function replaceClassSubjectOfferings(
  previous: string[],
  programId: string,
  classLevel: number,
  subjects: Subject[],
): string[] {
  const kept = previous.filter((token) => {
    const parsed = parseOfferingToken(token);
    return !(
      parsed &&
      parsed.programId === programId &&
      parsed.classLevel === classLevel
    );
  });
  return [
    ...kept,
    ...subjects.map((subject) => encodeOffering(programId, classLevel, subject)),
  ];
}

/**
 * When custom classes are checked/unchecked, keep offering tokens in sync:
 * new classes get all default subjects; removed classes drop their tokens.
 */
export function syncCustomSubjectOfferings(
  previous: string[],
  classes: string[],
  programId: string,
): string[] {
  const levels = new Set(
    classes.map(Number).filter((level) => Number.isInteger(level) && level >= 1 && level <= 12),
  );
  const kept = previous.filter((token) => {
    const parsed = parseOfferingToken(token);
    return (
      parsed !== null &&
      (parsed.programId === programId || parsed.programId === CUSTOM_DRAFT_PROGRAM_ID) &&
      levels.has(parsed.classLevel)
    );
  });

  for (const classLevel of levels) {
    const hasSubjects = kept.some((token) => {
      const parsed = parseOfferingToken(token);
      return parsed?.classLevel === classLevel;
    });
    if (hasSubjects) continue;
    for (const subject of subjectsForClassLevel(classLevel)) {
      kept.push(encodeOffering(programId, classLevel, subject));
    }
  }

  return kept;
}

/** Catalog programs expanded so Add class can pick any enrolled catalog class. */
export function catalogProgramsForForm(
  catalog: LearningProgram[],
  live: SchoolProgramOffering[] = [],
): SchoolProgramOffering[] {
  const year = new Date().getFullYear();
  const liveById = new Map(live.map((row) => [row.programId, row]));
  return catalog.map((program) => {
    const liveProgram = liveById.get(program.id);
    const levels = Array.from(
      { length: Math.max(0, program.classTo - program.classFrom + 1) },
      (_, index) => program.classFrom + index,
    );
    return {
      programId: program.id,
      programCode: program.code,
      programName: program.name,
      type: (program.type ?? "REGULAR") as SchoolType,
      year: program.year ?? year,
      classFrom: program.classFrom,
      classTo: program.classTo,
      catalogSubjects: program.subjects,
      classes: levels.map((classLevel) => ({
        classLevel,
        subjects:
          liveProgram?.classes.find((row) => row.classLevel === classLevel)?.subjects ?? [],
      })),
    };
  });
}

/** Single customized program with classes 1–12 for the registration Add-class UI. */
export function customizedProgramForForm(input: {
  offerings: string[];
  customProgramName: string;
  /** Prefer school name so Add class shows the same label as Programs. */
  schoolName?: string;
  savedPrograms: SchoolProgramOffering[];
}): SchoolProgramOffering[] {
  const year = new Date().getFullYear();
  const saved =
    input.savedPrograms.find((row) => row.type === "CUSTOMIZED") ?? input.savedPrograms[0];
  const programId = saved?.programId ?? CUSTOM_DRAFT_PROGRAM_ID;
  const programName =
    input.schoolName?.trim() ||
    input.customProgramName.trim() ||
    saved?.programName ||
    "Custom Program";
  const subjectsByClass = new Map(
    offeringsToPrograms(input.offerings)
      .filter(
        (row) => row.programId === programId || row.programId === CUSTOM_DRAFT_PROGRAM_ID,
      )
      .flatMap((row) => row.classes.map((cls) => [cls.classLevel, cls.subjects] as const)),
  );
  const levels = Array.from({ length: 12 }, (_, index) => index + 1);
  return [
    {
      programId,
      programCode: saved?.programCode ?? "CUSTOM",
      programName,
      type: "CUSTOMIZED" as const,
      year: saved?.year ?? year,
      classFrom: 1,
      classTo: 12,
      catalogSubjects: saved?.catalogSubjects ?? [],
      classes: levels.map((classLevel) => ({
        classLevel,
        subjects: subjectsByClass.get(classLevel) ?? [],
      })),
    },
  ];
}

/** Prefer the narrowest Regular catalog program that covers this class. */
export function pickRegularProgramForClass<
  T extends { id: string; classFrom: number; classTo: number; name: string; subjects: string[] },
>(catalog: T[], classLevel: number): T | null {
  const covering = catalog
    .filter((program) => classLevel >= program.classFrom && classLevel <= program.classTo)
    .sort(
      (a, b) =>
        a.classTo - a.classFrom - (b.classTo - b.classFrom) || a.name.localeCompare(b.name),
    );
  return covering[0] ?? null;
}

/**
 * Customized → Regular: map each class onto one Regular catalog program and
 * emit offering tokens (so Add class / edit dropdowns show real program names).
 */
export function seedRegularOfferingTokens(
  catalog: LearningProgram[],
  levels: number[],
  subjectsByClass?: Map<number, Subject[]>,
): string[] {
  const regular = catalog.filter((program) => (program.type ?? "REGULAR") === "REGULAR");
  const tokens: string[] = [];
  for (const classLevel of [...new Set(levels)]
    .filter((level) => Number.isInteger(level) && level >= 1 && level <= 12)
    .sort((a, b) => a - b)) {
    const pick = pickRegularProgramForClass(regular, classLevel);
    if (!pick) continue;
    const allowed = new Set(pick.subjects);
    const previous = (subjectsByClass?.get(classLevel) ?? []).filter((subject) =>
      allowed.has(subject),
    );
    const defaults = subjectsForClassLevel(classLevel).filter((subject) => allowed.has(subject));
    const subjects = (previous.length > 0 ? previous : defaults.length > 0 ? defaults : pick.subjects) as Subject[];
    for (const subject of subjects) {
      tokens.push(encodeOffering(pick.id, classLevel, subject));
    }
  }
  return tokens;
}

export function seedRegularProgramsInput(
  catalog: LearningProgram[],
  levels: number[],
  subjectsByClass?: Map<number, Subject[]>,
): SchoolProgramInput[] {
  return offeringsToPrograms(seedRegularOfferingTokens(catalog, levels, subjectsByClass));
}

/**
 * Live Programs & classes checks → offerings shape used by Classes & sections.
 * Keeps Add-class dropdowns in sync with the form before Save.
 */
export function liveOfferingsFromForm(input: {
  schoolType: SchoolType;
  offerings: string[];
  customClasses: string[];
  customProgramName: string;
  schoolName?: string;
  catalog: LearningProgram[];
  savedPrograms: SchoolProgramOffering[];
}): SchoolProgramOffering[] {
  const year = new Date().getFullYear();

  if (input.schoolType === "CUSTOMIZED") {
    const saved =
      input.savedPrograms.find((row) => row.type === "CUSTOMIZED") ?? input.savedPrograms[0];
    const levels = [...new Set(input.customClasses.map(Number))]
      .filter((level) => Number.isInteger(level) && level >= 1 && level <= 12)
      .sort((a, b) => a - b);
    if (levels.length === 0) return [];
    const programId = saved?.programId ?? CUSTOM_DRAFT_PROGRAM_ID;
    const programName =
      input.schoolName?.trim() ||
      input.customProgramName.trim() ||
      saved?.programName ||
      "Custom Program";
    const subjectsByClass = new Map(
      offeringsToPrograms(input.offerings)
        .filter((row) => row.programId === programId || row.programId === CUSTOM_DRAFT_PROGRAM_ID)
        .flatMap((row) => row.classes.map((cls) => [cls.classLevel, cls.subjects] as const)),
    );
    return [
      {
        programId,
        programCode: saved?.programCode ?? "CUSTOM",
        programName,
        type: "CUSTOMIZED" as const,
        year: saved?.year ?? year,
        classFrom: levels[0],
        classTo: levels[levels.length - 1],
        catalogSubjects: saved?.catalogSubjects ?? [],
        classes: levels.map((classLevel) => ({
          classLevel,
          subjects: subjectsByClass.get(classLevel)?.length
            ? subjectsByClass.get(classLevel)!
            : subjectsForClassLevel(classLevel),
        })),
      },
    ];
  }

  const programs = offeringsToPrograms(input.offerings);
  return programs.flatMap((program) => {
    const catalog = input.catalog.find((row) => row.id === program.programId);
    const saved = input.savedPrograms.find((row) => row.programId === program.programId);
    if (!catalog && !saved) return [];
    const classLevels = program.classes.map((row) => row.classLevel);
    return [
      {
        programId: program.programId,
        programCode: catalog?.code ?? saved?.programCode ?? "",
        programName: catalog?.name ?? saved?.programName ?? "",
        type: "REGULAR" as const,
        year: saved?.year ?? year,
        classFrom: Math.min(...classLevels),
        classTo: Math.max(...classLevels),
        catalogSubjects: catalog?.subjects ?? saved?.catalogSubjects ?? [],
        classes: program.classes,
      },
    ];
  });
}
