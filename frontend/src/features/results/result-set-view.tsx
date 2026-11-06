import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { wasEdited } from "@/features/documents/constants";
import { SchoolTypeBadge } from "@/features/schools/school-type-badge";
import type { ResultSet, ResultSheet } from "@/types/result";
import { formatDateTime } from "@/utils/format";
import {
  RESULTS_PATH,
  SCHOOL_RESULTS_PATH,
  resultProgramLabel,
  resultSetHref,
  resultSheetDownloadHref,
} from "./constants";
import { ResultSheetCard } from "./result-sheet-card";

type ResultSetViewProps = {
  resultSet: ResultSet;
  /** The selected class's sheet. */
  sheet: ResultSheet;
  /** `/admin/results` or `/results`. */
  basePath: string;
  /** Shown to admins, who need to know which school this is. */
  showSchool?: boolean;
  showDownload?: boolean;
  backHref?: string;
  actions?: ReactNode;
};

/** A test's results: a title line, a tab per uploaded class, and that class's students. */
export function ResultSetView({
  resultSet,
  sheet,
  basePath,
  showSchool = false,
  showDownload = true,
  actions,
}: ResultSetViewProps) {
  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-neutral-950">
            Test ID {resultSet.testId}{" "}
            <span className="text-neutral-300">·</span> Test No {resultSet.testNumber}{" "}
            <span className="text-neutral-300">·</span> {resultProgramLabel(resultSet)}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
            {showSchool && (
              <>
                <span className="font-medium text-neutral-800">{resultSet.school.name}</span>
                <SchoolTypeBadge type={resultSet.school.type} size="sm" />
                <span aria-hidden className="text-neutral-300">·</span>
              </>
            )}
            <span>
              <span className="font-semibold text-neutral-800">
                {wasEdited(resultSet) ? "Updated on" : "Published on"}
              </span>{" "}
              {formatDateTime(resultSet.updatedAt)}
            </span>
          </p>
        </div>
        {actions}
      </div>

      {resultSet.classes.length > 1 && (
        <nav aria-label="Class" className="flex gap-1.5 overflow-x-auto border-b border-brand-100">
          {resultSet.classes.map((item) => {
            const active = item.classLevel === sheet.classLevel;
            return (
              <Link
                key={item.classLevel}
                href={resultSetHref(basePath, resultSet.id, item.classLevel)}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={cn(
                  "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "border-brand-900 text-brand-900"
                    : "border-transparent text-neutral-500 hover:border-brand-200 hover:text-brand-800",
                )}
              >
                Class {item.classLevel}
              </Link>
            );
          })}
        </nav>
      )}

      <ResultSheetCard
        key={sheet.classLevel}
        studentLink={studentLinkFor(basePath, resultSet.school.id)}
        sheet={sheet}
        downloadHref={resultSheetDownloadHref(basePath, resultSet.id, sheet.classLevel)}
        showDownload={showDownload}
      />
    </div>
  );
}

/** Registration numbers in the sheet open that student's profile in the same portal. */
function studentLinkFor(basePath: string, schoolId: string) {
  if (basePath === RESULTS_PATH) return { base: "/admin/schools/students/roll", query: `?school=${schoolId}` };
  if (basePath === SCHOOL_RESULTS_PATH) return { base: "/school/students/roll" };
  return { base: "/teacher/students/roll" };
}

/** Picks the class from `?class=`, falling back to the first uploaded class. */
export function selectedClass(resultSet: ResultSet, requested: string | string[] | undefined) {
  const level = Number(Array.isArray(requested) ? requested[0] : requested);
  return resultSet.classes.find((item) => item.classLevel === level)?.classLevel ?? resultSet.classes[0]?.classLevel;
}
