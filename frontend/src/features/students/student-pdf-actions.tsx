"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { SharePdfButton } from "@/components/shared/share-pdf-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { printPdf } from "@/features/answer-keys/print-pdf";
import { cn } from "@/lib/utils";
import { downloadFileName } from "@/utils/download-file-name";
import { REPORT_TEST_NUMBERS, type PerformancePortal, type ReportCardKind } from "./portal";
import {
  classProfilesPdfHref,
  classReportCardsHref,
  studentPdfHref,
} from "./report-card-hrefs";
import { downloadReportPdf, emptyReportMessage } from "./report-download";
import { StudentReportDownloads } from "./student-report-downloads";

export {
  classProfilesPdfHref,
  classReportCardsHref,
  studentPdfHref,
  studentRankCardsHref,
  studentReportCardHref,
} from "./report-card-hrefs";
export { StudentReportCardLinks, StudentReportDownloads } from "./student-report-downloads";
export type { PerformancePortal, ReportCardKind } from "./portal";

const titleCase = (label: string) =>
  label.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());

const MENU_TRIGGER =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors [&_svg]:size-3.5";

function reportFileName(
  kind: ReportCardKind,
  parts: Array<string | number | null | undefined>,
  options?: { subject?: string; test?: number },
) {
  const prefix =
    kind === "year"
      ? "Year-Report"
      : kind === "subjects"
        ? options?.subject
          ? `Subject-${options.subject}`
          : "Subject-Report-All"
        : options?.test != null
          ? `Test-${options.test}-Report`
          : "Test-Report-Cards";
  return downloadFileName([prefix, ...parts], "pdf");
}

/** Print and download profile PDF + report downloads for one student. */
export function StudentPdfActions({
  portal,
  studentId,
  studentName,
  rollNo,
  schoolName,
  programName,
  classLevel,
  subjects = [],
  outlineClassName,
}: {
  portal: PerformancePortal;
  studentId: string;
  studentName?: string;
  rollNo?: string;
  schoolName?: string;
  programName?: string;
  classLevel?: number;
  subjects?: string[];
  outlineClassName: string;
}) {
  const [printing, setPrinting] = useState(false);
  const fileName = downloadFileName(
    [
      "Student-Profile",
      schoolName,
      programName,
      classLevel != null ? `Class-${classLevel}` : null,
      studentName,
      rollNo,
    ],
    "pdf",
  );

  return (
    <>
      <button
        type="button"
        disabled={printing}
        className={outlineClassName}
        onClick={() => {
          setPrinting(true);
          printPdf(studentPdfHref(portal, studentId), () => setPrinting(false), fileName);
        }}
      >
        {printing ? <Loader2 className="animate-spin" /> : <Printer />}
        Print
      </button>
      <a href={studentPdfHref(portal, studentId, true)} className={outlineClassName} download={fileName}>
        <Download />
        PDF
      </a>
      <StudentReportDownloads
        portal={portal}
        studentId={studentId}
        studentName={studentName}
        rollNo={rollNo}
        schoolName={schoolName}
        programName={programName}
        classLevel={classLevel}
        subjects={subjects}
        triggerClassName={outlineClassName}
      />
      <SharePdfButton
        href={studentPdfHref(portal, studentId, true)}
        fileName={fileName}
        title="student profile"
        preload
        className={outlineClassName}
      >
        Share
      </SharePdfButton>
    </>
  );
}

/**
 * Class downloads: one PDF with every student on separate pages.
 * Year · Tests (All or one) · Subjects (All or one).
 */
export function ClassProfilesPdfActions({
  portal,
  studentIds,
  label = "profile cards",
  scopeLabel,
  schoolName,
  subjects = [],
  tests = REPORT_TEST_NUMBERS,
  className,
}: {
  portal: PerformancePortal;
  studentIds: string[];
  label?: string;
  scopeLabel?: string;
  schoolName?: string;
  subjects?: string[];
  tests?: number[];
  className?: string;
}) {
  const [printing, setPrinting] = useState(false);
  const [pending, startTransition] = useTransition();
  if (studentIds.length === 0) return null;
  const title = `${studentIds.length} student profile ${studentIds.length === 1 ? "card" : "cards"}`;
  const fileName = downloadFileName(["Student-Profiles", schoolName, scopeLabel ?? label], "pdf");
  const meta = [schoolName, scopeLabel];
  const uniqueSubjects = [...new Set(subjects.map((row) => row.trim().toUpperCase()).filter(Boolean))];
  const uniqueTests = [...new Set(tests.filter((n) => Number.isInteger(n) && n >= 1 && n <= 18))].sort(
    (a, b) => a - b,
  );

  function download(kind: ReportCardKind, options?: { subject?: string; test?: number }) {
    const href = classReportCardsHref(portal, studentIds, kind, { download: true, ...options });
    const name = reportFileName(kind, meta, options);
    startTransition(async () => {
      try {
        await downloadReportPdf(href, name);
      } catch {
        toast.error(emptyReportMessage(kind, options));
      }
    });
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button
        type="button"
        title={`Print ${title}`}
        disabled={printing || pending}
        onClick={() => {
          setPrinting(true);
          printPdf(classProfilesPdfHref(portal, studentIds), () => setPrinting(false), fileName);
        }}
        className={cn(
          MENU_TRIGGER,
          "border border-brand-200 bg-white text-brand-900 hover:border-brand-900 hover:bg-brand-50 disabled:opacity-60",
        )}
      >
        {printing ? <Loader2 className="animate-spin" /> : <Printer />}
        Print {label}
      </button>
      <a
        href={classProfilesPdfHref(portal, studentIds, true)}
        title={`Download ${title}`}
        download={fileName}
        className={cn(MENU_TRIGGER, "bg-brand-900 text-white hover:bg-brand-800 active:scale-[0.98]")}
      >
        <Download />
        Profiles
      </a>
      <button
        type="button"
        title="Year report — one page per student"
        disabled={pending}
        onClick={() => download("year")}
        className={cn(
          MENU_TRIGGER,
          "border border-violet-200 bg-white text-violet-900 hover:border-violet-700 hover:bg-violet-50 disabled:opacity-60",
        )}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Download />}
        Year Report
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          title="Tests report — All or one test"
          disabled={pending}
          className={cn(
            MENU_TRIGGER,
            "border border-violet-200 bg-white text-violet-900 hover:border-violet-700 hover:bg-violet-50 disabled:opacity-60",
          )}
        >
          <Download />
          Tests Report
          <ChevronDown className="opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44 max-h-72 overflow-y-auto">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Class tests report</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={pending}
              onClick={() => download("tests")}
              className="cursor-pointer"
            >
              All tests
            </DropdownMenuItem>
            {uniqueTests.map((test) => (
              <DropdownMenuItem
                key={test}
                disabled={pending}
                onClick={() => download("tests", { test })}
                className="cursor-pointer"
              >
                Test {test}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          title="Subjects report — All or one subject"
          disabled={pending}
          className={cn(
            MENU_TRIGGER,
            "border border-violet-200 bg-white text-violet-900 hover:border-violet-700 hover:bg-violet-50 disabled:opacity-60",
          )}
        >
          <Download />
          Subjects Report
          <ChevronDown className="opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Class subjects report</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={pending}
              onClick={() => download("subjects")}
              className="cursor-pointer"
            >
              All subjects
            </DropdownMenuItem>
            {uniqueSubjects.map((subject) => (
              <DropdownMenuItem
                key={subject}
                disabled={pending}
                onClick={() => download("subjects", { subject })}
                className="cursor-pointer"
              >
                {titleCase(subject)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** @deprecated Prefer StudentReportDownloads — kept for older call sites. */
export const REPORT_CARD_KINDS: Array<{ kind: ReportCardKind; label: string; short: string }> = [
  { kind: "year", label: "Year report", short: "Year" },
  { kind: "tests", label: "Test-wise report cards", short: "Tests" },
  { kind: "subjects", label: "Subject-wise report", short: "Subjects" },
];
