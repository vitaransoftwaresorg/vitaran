import { PageHero } from "@/components/shared/page-hero";
import { Reveal } from "@/components/shared/reveal";
import { subjectLabel } from "@/features/schools/constants";
import type { Subject } from "@/types/school";
import type { TeacherAssignment } from "@/types/teacher";
import { booksForPortalProgram, isRegularCatalog, portalPrograms } from "./portal-programs";
import { ProgramTabs } from "./program-tabs";
import type { SolutionBook } from "./solution-books";

type ResourcePageProps = {
  title: string;
  highlight: string;
  books: Record<string, SolutionBook[]>;
  /** Programs the viewer has been given; others are never sent to the browser. */
  programIds: string[];
  /** Regular catalogs a customized school enrolled in — source of question papers. */
  catalogIds?: string[];
  programNames?: Record<string, string>;
  /** Subjects the viewer has been given; books in other subjects are never sent either. */
  subjectIds: Subject[];
  /**
   * Exact program + class + subject access (school offerings or teacher assignments).
   * When present, books must match all three — not subject alone.
   */
  assignments?: TeacherAssignment[];
  label: string;
  emptyMessage: string;
  /** Skip the public PageHero when embedded in a portal. */
  compact?: boolean;
};

function bookAllowed(
  book: SolutionBook,
  programId: string,
  subjectIds: Subject[],
  assignments?: TeacherAssignment[],
) {
  if (assignments && assignments.length > 0) {
    return assignments.some((item) => {
      if (subjectLabel(item.subject) !== book.subject || item.classLevel !== book.grade) return false;
      if (item.programCode === programId) return true;
      return !isRegularCatalog(programId) && isRegularCatalog(item.programCode);
    });
  }
  const allowedSubjects = new Set(subjectIds.map((id) => subjectLabel(id)));
  return allowedSubjects.has(book.subject);
}

export function ResourcePage({
  title,
  highlight,
  books,
  programIds,
  catalogIds,
  programNames: programNamesProp,
  subjectIds,
  assignments,
  label,
  emptyMessage,
  compact,
}: ResourcePageProps) {
  // Only tabs that have at least one offering/assignment for that program.
  const visibleProgramIds =
    assignments && assignments.length > 0
      ? programIds.filter((id) => assignments.some((row) => row.programCode === id))
      : programIds;

  const programNames = {
    ...Object.fromEntries((assignments ?? []).map((row) => [row.programCode, row.programName])),
    ...programNamesProp,
  };
  const visiblePrograms = portalPrograms(visibleProgramIds, programNames);
  const allowedBooks = Object.fromEntries(
    visiblePrograms.map((program) => [
      program.title,
      booksForPortalProgram(program, books, assignments, catalogIds).filter((book) =>
        bookAllowed(book, program.id, subjectIds, assignments),
      ),
    ]),
  );

  const tabs = (
    <ProgramTabs
      programIds={visibleProgramIds}
      programNames={programNames}
      books={allowedBooks}
      label={label}
      emptyMessage={emptyMessage}
    />
  );

  if (compact) {
    return (
      <section className="px-4 py-2 sm:px-5 lg:px-6">
        <div className="mx-auto max-w-5xl">{tabs}</div>
      </section>
    );
  }

  return (
    <>
      <PageHero
        title={
          <>
            {title} <span className="text-gradient">{highlight}</span>
          </>
        }
      />

      <section className="py-10 sm:py-12">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <Reveal>{tabs}</Reveal>
        </div>
      </section>
    </>
  );
}
