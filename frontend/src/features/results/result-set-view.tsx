import type { ReactNode } from "react";
import { wasEdited } from "@/features/documents/constants";
import { SchoolTypeBadge } from "@/features/schools/school-type-badge";
import type { ResultSet, ResultSheet } from "@/types/result";
import type { ClassScan } from "@/types/scan";
import { downloadFileName } from "@/utils/download-file-name";
import { formatDateTime } from "@/utils/format";
import {
  PUBLIC_RESULTS_PATH,
  RESULTS_PATH,
  SCHOOL_RESULTS_PATH,
  resultProgramLabel,
  resultSheetDownloadHref,
} from "./constants";
import { ResultClassTabs } from "./result-class-tabs";
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
  /** Saved OMRs of the selected class; adds the rank card and OMR columns. */
  scans?: ClassScan[];
  /** School/teacher: open student profile in-page instead of navigating away. */
  onStudentClick?: (roll: string) => void;
  /** School/teacher/public: unpublished class tabs show an alert instead of opening. */
  blockUnpublishedClasses?: boolean;
  /** Keep School ID on public class tab links. */
  schoolCode?: string;
};

/** A test's results: a title line, a tab per uploaded class, and that class's students. */
export function ResultSetView({
  resultSet,
  sheet,
  basePath,
  showSchool = false,
  showDownload = true,
  actions,
  scans,
  onStudentClick,
  blockUnpublishedClasses = false,
  schoolCode,
}: ResultSetViewProps) {
  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-neutral-950 sm:text-2xl">
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
            {!sheet.published || !resultSet.published ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                Not Published
              </span>
            ) : (
              <span>
                <span className="font-semibold text-neutral-800">
                  {wasEdited(resultSet) ? "Updated on" : "Published on"}
                </span>{" "}
                {formatDateTime(resultSet.updatedAt)}
              </span>
            )}
          </p>
        </div>
        {actions}
      </div>

      <ResultClassTabs
        classes={resultSet.classes}
        activeClassLevel={sheet.classLevel}
        basePath={basePath}
        resultSetId={resultSet.id}
        blockUnpublished={blockUnpublishedClasses}
        schoolCode={schoolCode}
      />

      <ResultSheetCard
        key={sheet.classLevel}
        studentLink={
          onStudentClick ? undefined : studentLinkFor(basePath, resultSet.school.id) ?? undefined
        }
        onStudentClick={onStudentClick}
        sheet={sheet}
        downloadHref={resultSheetDownloadHref(basePath, resultSet.id, sheet.classLevel)}
        downloadFileName={downloadFileName(
          [
            resultSet.school.name,
            resultProgramLabel(resultSet),
            `Class-${sheet.classLevel}`,
            `Test-${resultSet.testNumber}`,
            resultSet.testId,
            "results",
          ],
          "xlsx",
        )}
        showDownload={showDownload}
        files={
          scans
            ? {
                basePath,
                resultSetId: resultSet.id,
                scans,
                path: classScanFilter(resultSet, sheet.classLevel),
                schoolName: resultSet.school.name,
                programLabel: resultProgramLabel(resultSet),
                testNumber: resultSet.testNumber,
                testId: resultSet.testId,
              }
            : undefined
        }
      />
    </div>
  );
}

/** Registration numbers in the sheet open that student's profile in the same portal. Public has no links. */
function studentLinkFor(basePath: string, schoolId: string) {
  if (basePath === RESULTS_PATH) return { base: "/admin/schools/students/roll", query: `?school=${schoolId}` };
  if (basePath === SCHOOL_RESULTS_PATH) return { base: "/school/students/roll" };
  if (basePath === PUBLIC_RESULTS_PATH) return null;
  return { base: "/teacher/students/roll" };
}

/** Which saved OMRs belong to this class of the result. */
export function classScanFilter(resultSet: ResultSet, classLevel: number) {
  return {
    schoolId: resultSet.school.id,
    testNumber: resultSet.testNumber,
    classLevel,
    program: resultSet.program ?? undefined,
  };
}

/** Picks the class from `?class=`, falling back to the first uploaded class. */
export function selectedClass(resultSet: ResultSet, requested: string | string[] | undefined) {
  const level = Number(Array.isArray(requested) ? requested[0] : requested);
  return resultSet.classes.find((item) => item.classLevel === level)?.classLevel ?? resultSet.classes[0]?.classLevel;
}
