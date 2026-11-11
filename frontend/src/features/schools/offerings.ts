import type { SchoolProgramInput, Subject } from "@/types/school";
import type { SchoolProgramOffering } from "@/types/program";

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
