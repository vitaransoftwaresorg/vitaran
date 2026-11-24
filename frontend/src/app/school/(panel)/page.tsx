import Link from "next/link";
import { BookOpen, GraduationCap, KeyRound, ScanLine, School2, Trophy, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { ActionBanner, Panel, STAT_GRID, StatCard } from "@/features/admin/dashboard-parts";
import { verifySchoolSession } from "@/features/school-auth/session";
import { programDisplayName, subjectLabel } from "@/features/schools/constants";
import { capitalizeWords } from "@/features/schools/schema";
import {
  booksForPortalProgram,
  portalProgramIds,
  portalPrograms,
  regularCatalogIds,
} from "@/features/teachers-resources/portal-programs";
import { loadSolutionBooksFromDb } from "@/features/teachers-resources/load-solution-books";
import type { SolutionBook } from "@/features/teachers-resources/solution-books";
import { listSchoolPortalStudentResources } from "@/services/school-student-resources";
import { getSchoolStudentCounts } from "@/services/students";
import { getSchoolDashboard } from "@/services/teachers";
import { cn } from "@/lib/utils";

function countResources(
  programCodes: string[],
  subjectIds: string[],
  books: Record<string, SolutionBook[]>,
  names?: Record<string, string>,
) {
  const subjects = new Set(subjectIds.map((id) => subjectLabel(id)));
  const catalogIds = regularCatalogIds(programCodes);
  return portalPrograms(portalProgramIds(programCodes), names).reduce((total, program) => {
    const programBooks = booksForPortalProgram(program, books, undefined, catalogIds);
    return total + programBooks.filter((book) => subjects.has(book.subject)).length;
  }, 0);
}

export default async function SchoolDashboardPage() {
  const school = await verifySchoolSession();
  const isCustomized = (school.type ?? "REGULAR") === "CUSTOMIZED";
  const [stats, studentCounts, booksOrCustom] = await Promise.all([
    getSchoolDashboard(),
    getSchoolStudentCounts(),
    isCustomized
      ? listSchoolPortalStudentResources().catch(() => [])
      : loadSolutionBooksFromDb(),
  ]);
  const programNames = Object.fromEntries(stats.programLabels.map((row) => [row.code, row.name]));
  const ownPrograms = stats.programLabels;
  const resources = isCustomized
    ? (booksOrCustom as Awaited<ReturnType<typeof listSchoolPortalStudentResources>>).length
    : countResources(
        stats.programLabels.map((row) => row.code),
        stats.subjectIds,
        booksOrCustom as Record<string, SolutionBook[]>,
        programNames,
      );
  const studentTotal = Object.values(studentCounts.byProgram).reduce((sum, n) => sum + n, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${capitalizeWords(stats.schoolName)} · ${stats.schoolCode}`}
        actions={
          <Link href="/school/teachers/new" className={cn(buttonVariants(), "h-10 w-full sm:w-auto")}>
            Add teacher
          </Link>
        }
      />

      <div className={cn(STAT_GRID, "sm:grid-cols-3 2xl:grid-cols-6")}>
        <StatCard
          label="Teachers"
          value={stats.teachers.total}
          hint={`${stats.teachers.active} active`}
          icon={Users}
          href="/school/teachers"
        />
        <StatCard
          label="Students"
          value={studentTotal}
          hint={`${stats.classes} classes`}
          icon={GraduationCap}
          href="/school/students"
        />
        <StatCard
          label="Classes"
          value={stats.classes}
          hint={`${stats.programs} programs`}
          icon={School2}
          href="/school/classes"
        />
        <StatCard
          label="Resources"
          value={resources}
          hint={
            isCustomized
              ? "Customized PDFs for this school"
              : `${stats.programs} programs · ${stats.subjects} subjects`
          }
          icon={BookOpen}
          href="/school/resources"
        />
        <StatCard
          label="Answer keys"
          value={stats.answerKeys}
          hint={isCustomized ? "Only keys for this school" : "Published for your school"}
          icon={KeyRound}
          href="/school/answer-keys"
        />
        <StatCard
          label="Results"
          value={stats.results}
          hint="Published for your school"
          icon={Trophy}
          href="/school/results"
        />
      </div>

      <div className="mt-4">
        <ActionBanner
          href="/school/omr-scan"
          icon={ScanLine}
          title="OMR Scan"
          description="Scan answer sheets with the phone camera or upload a PDF."
          cta="Start scanning"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel compact title="Your programs" description="Assigned by Vitaran for this school.">
          <ul className="flex flex-wrap gap-2">
            {ownPrograms.length > 0 ? (
              ownPrograms.map((program) => (
                <li
                  key={program.code}
                  className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800"
                >
                  {programDisplayName(
                    { code: program.code, name: program.name },
                    stats.schoolName,
                  )}
                </li>
              ))
            ) : (
              <li className="text-sm text-neutral-500">No programs yet.</li>
            )}
          </ul>
        </Panel>

        <Panel compact title="Your subjects" description="Teachers can only be assigned these subjects.">
          <ul className="flex flex-wrap gap-2">
            {stats.subjectIds.length > 0 ? (
              stats.subjectIds.map((subject) => (
                <li
                  key={subject}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-800"
                >
                  {subjectLabel(subject)}
                </li>
              ))
            ) : (
              <li className="text-sm text-neutral-500">No subjects yet.</li>
            )}
          </ul>
        </Panel>
      </div>
    </>
  );
}
