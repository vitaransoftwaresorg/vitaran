import { Layers } from "lucide-react";
import { programLabel, subjectLabel } from "@/features/schools/constants";
import type { TeacherAssignment } from "@/types/teacher";
import { programs, type ProgramContent } from "./content";
import { solutionBooks, type SolutionBook } from "./solution-books";

const CATALOG_TITLES = programs.map((program) => program.title);

/** Prefer Advanced when a customized school has no regular enrolment to copy from. */
const CATALOG_PREFERENCE = [
  "Advanced Program",
  "Revised Advanced Program",
  "Integrated Program",
  "Olympiad Program",
  "Olympiad Program Class 1 to 5",
];

export type PortalProgram = ProgramContent;

/**
 * Newer regular catalog codes that reuse solution books / labels from a classic program.
 * DB may enrol NEWINTEGRATED while Teachers Resources still ships Integrated PDFs.
 */
const CATALOG_BOOK_ALIASES: Record<string, string> = {
  NEWADVANCED: "ADVANCED",
  NEWINTEGRATED: "INTEGRATED",
};

export function catalogSourceId(code: string) {
  return CATALOG_BOOK_ALIASES[code] ?? code;
}

export function isRegularCatalog(code: string) {
  return programs.some((program) => program.id === catalogSourceId(code));
}

/** Regular programs selected for solution-book sources (aliases resolve to classic codes). */
export function regularCatalogIds(programCodes: string[]) {
  return [
    ...new Set(
      programCodes
        .map(catalogSourceId)
        .filter((code) => programs.some((program) => program.id === code)),
    ),
  ];
}

/** Customized / non-classic catalog codes — the school's own program tabs. */
export function customProgramIds(programCodes: string[]) {
  return programCodes.filter((code) => !programs.some((program) => program.id === code));
}

/**
 * Every enrolled program the portal should show as a tab.
 * Do not drop classic codes (ADVANCED) when NEW* codes are also present.
 */
export function portalProgramIds(programCodes: string[]) {
  return [...new Set(programCodes)];
}

/** Regular catalog tabs first, then customized programs the school actually has. */
export function portalPrograms(
  programIds: string[],
  names?: Record<string, string>,
): PortalProgram[] {
  const seen = new Set<string>();
  const result: PortalProgram[] = [];

  for (const program of programs) {
    if (!programIds.includes(program.id) || seen.has(program.id)) continue;
    seen.add(program.id);
    result.push(program);
  }

  for (const id of programIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      icon: Layers,
      title: programLabel(id, names?.[id]),
    });
  }

  return result;
}

function catalogScore(title: string, slots: TeacherAssignment[], books: Record<string, SolutionBook[]>) {
  return (books[title] ?? []).filter((book) =>
    slots.some((slot) => subjectLabel(slot.subject) === book.subject && slot.classLevel === book.grade),
  ).length;
}

function preferenceRank(title: string) {
  const index = CATALOG_PREFERENCE.indexOf(title);
  return index === -1 ? CATALOG_PREFERENCE.length : index;
}

function fallbackCatalogTitle(
  programId: string,
  books: Record<string, SolutionBook[]>,
  assignments?: TeacherAssignment[],
) {
  const slots = (assignments ?? []).filter((row) => row.programCode === programId);
  return (
    [...CATALOG_TITLES].sort((a, b) => {
      const scoreA = slots.length > 0 ? catalogScore(a, slots, books) : 0;
      const scoreB = slots.length > 0 ? catalogScore(b, slots, books) : 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return preferenceRank(a) - preferenceRank(b);
    })[0] ?? CATALOG_TITLES[0]
  );
}

function titlesForCatalogs(catalogIds: string[]) {
  return programs.filter((program) => catalogIds.includes(program.id)).map((program) => program.title);
}

/** Solution books for a portal tab. Customized programs use the school's enrolled regular catalogs. */
export function booksForPortalProgram(
  program: PortalProgram,
  books: Record<string, SolutionBook[]> = solutionBooks,
  assignments?: TeacherAssignment[],
  catalogIds?: string[],
) {
  if (books[program.title]) return books[program.title] ?? [];

  // NEWADVANCED / NEWINTEGRATED → classic Advanced / Integrated PDFs.
  const aliased = programs.find((row) => row.id === catalogSourceId(program.id));
  if (aliased && books[aliased.title]?.length) return books[aliased.title] ?? [];

  const enrolledTitles = titlesForCatalogs(catalogIds ?? []);
  const titles =
    enrolledTitles.length > 0
      ? enrolledTitles
      : [fallbackCatalogTitle(program.id, books, assignments)].filter(Boolean);

  const seen = new Set<string>();
  const pooled: SolutionBook[] = [];
  for (const title of titles) {
    for (const book of books[title] ?? []) {
      if (seen.has(book.href)) continue;
      seen.add(book.href);
      pooled.push(book);
    }
  }
  return pooled;
}
