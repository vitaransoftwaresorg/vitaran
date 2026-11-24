import "server-only";
import { subjectLabel } from "@/features/schools/constants";
import { listPublicRegularTeacherResources } from "@/services/regular-teacher-resources";
import { programs } from "./content";
import { teacherResourceHref } from "./solution-book-path";
import type { SolutionBook, Subject } from "./solution-books";

/** Empty program buckets so tabs still render when the DB has no PDFs yet. */
export function emptySolutionBooks(): Record<string, SolutionBook[]> {
  return Object.fromEntries(programs.map((program) => [program.title, [] as SolutionBook[]]));
}

/** Map DB regular teacher resources → UI catalog keyed by program title. */
export function resourcesToSolutionBooks(
  rows: Array<{
    programCode: string;
    classLevel: number;
    subject: string;
    volume: number | null;
  }>,
): Record<string, SolutionBook[]> {
  const books = emptySolutionBooks();
  for (const row of rows) {
    const program = programs.find((item) => item.id === row.programCode);
    if (!program) continue;
    const list = books[program.title] ?? [];
    list.push({
      subject: subjectLabel(row.subject) as Subject,
      grade: row.classLevel,
      ...(row.volume != null && row.volume > 0 ? { volume: row.volume } : {}),
      href: teacherResourceHref(row.programCode, row.classLevel, row.subject, row.volume),
    });
    books[program.title] = list;
  }
  return books;
}

/** Load regular solution books from the API (falls back to empty catalog). */
export async function loadSolutionBooksFromDb(): Promise<Record<string, SolutionBook[]>> {
  try {
    const rows = await listPublicRegularTeacherResources();
    return resourcesToSolutionBooks(rows);
  } catch {
    return emptySolutionBooks();
  }
}
