"use client";

import { ChevronDown, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { downloadFileName } from "@/utils/download-file-name";
import { REPORT_TEST_NUMBERS, type PerformancePortal, type ReportCardKind } from "./portal";
import { studentReportCardHref } from "./report-card-hrefs";

const titleCase = (label: string) =>
  label.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());

const MENU_TRIGGER =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors [&_svg]:size-3.5";

const LINK_CLASS =
  "inline-flex h-7 items-center gap-0.5 rounded-md px-1.5 text-[10px] font-semibold whitespace-nowrap text-violet-800 hover:bg-violet-50";

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

/** Year / Tests / Subjects downloads for one student (Subjects → All or one subject). */
export function StudentReportDownloads({
  portal,
  studentId,
  studentName,
  rollNo,
  schoolName,
  programName,
  classLevel,
  subjects = [],
  triggerClassName,
}: {
  portal: PerformancePortal;
  studentId: string;
  studentName?: string;
  rollNo?: string;
  schoolName?: string;
  programName?: string;
  classLevel?: number;
  /** Subject labels for the Subjects menu (e.g. MATHEMATICS). */
  subjects?: string[];
  triggerClassName?: string;
}) {
  const meta = [schoolName, programName, classLevel != null ? `Class-${classLevel}` : null, studentName, rollNo];
  const uniqueSubjects = [...new Set(subjects.map((label) => label.trim().toUpperCase()).filter(Boolean))];

  function link(kind: ReportCardKind, options?: { subject?: string; test?: number }) {
    return {
      href: studentReportCardHref(portal, studentId, kind, { download: true, ...options }),
      download: reportFileName(kind, meta, options),
    };
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          MENU_TRIGGER,
          "border border-violet-200 bg-white text-violet-900 hover:bg-violet-50",
          triggerClassName,
        )}
      >
        <Download />
        Reports
        <ChevronDown className="opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>This student</DropdownMenuLabel>
          <DropdownMenuItem render={<a {...link("year")} />} className="cursor-pointer">
            Year report
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tests report</DropdownMenuLabel>
          <DropdownMenuItem render={<a {...link("tests")} />} className="cursor-pointer">
            All tests
          </DropdownMenuItem>
          {REPORT_TEST_NUMBERS.map((test) => (
            <DropdownMenuItem
              key={test}
              render={<a {...link("tests", { test })} />}
              className="cursor-pointer"
            >
              Test {test}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Subjects report</DropdownMenuLabel>
          <DropdownMenuItem render={<a {...link("subjects")} />} className="cursor-pointer">
            All subjects
          </DropdownMenuItem>
          {uniqueSubjects.map((subject) => (
            <DropdownMenuItem
              key={subject}
              render={<a {...link("subjects", { subject })} />}
              className="cursor-pointer"
            >
              {titleCase(subject)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Compact row links: Year Report · Tests Report (All/one) · Subjects Report (All/one). */
export function StudentReportCardLinks({
  portal,
  studentId,
  studentName,
  rollNo,
  schoolName,
  subjects = [],
  tests = REPORT_TEST_NUMBERS,
  className,
}: {
  portal: PerformancePortal;
  studentId: string;
  studentName?: string;
  rollNo?: string;
  schoolName?: string;
  subjects?: string[];
  tests?: number[];
  className?: string;
}) {
  const meta = [schoolName, studentName, rollNo];
  const uniqueSubjects = [...new Set(subjects.map((label) => label.trim().toUpperCase()).filter(Boolean))];
  const uniqueTests = [...new Set(tests.filter((n) => Number.isInteger(n) && n >= 1 && n <= 18))].sort(
    (a, b) => a - b,
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-0.5", className)}>
      <a
        href={studentReportCardHref(portal, studentId, "year", { download: true })}
        download={reportFileName("year", meta)}
        title="Year report"
        className={LINK_CLASS}
      >
        Year Report
      </a>
      <DropdownMenu>
        <DropdownMenuTrigger title="Tests report — All or one test" className={LINK_CLASS}>
          Tests Report
          <ChevronDown className="size-3 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40 max-h-72 overflow-y-auto">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Tests report</DropdownMenuLabel>
            <DropdownMenuItem
              render={
                <a
                  href={studentReportCardHref(portal, studentId, "tests", { download: true })}
                  download={reportFileName("tests", meta)}
                />
              }
              className="cursor-pointer"
            >
              All tests
            </DropdownMenuItem>
            {uniqueTests.map((test) => (
              <DropdownMenuItem
                key={test}
                render={
                  <a
                    href={studentReportCardHref(portal, studentId, "tests", {
                      download: true,
                      test,
                    })}
                    download={reportFileName("tests", meta, { test })}
                  />
                }
                className="cursor-pointer"
              >
                Test {test}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger title="Subjects report — All or one subject" className={LINK_CLASS}>
          Subjects Report
          <ChevronDown className="size-3 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Subjects report</DropdownMenuLabel>
            <DropdownMenuItem
              render={
                <a
                  href={studentReportCardHref(portal, studentId, "subjects", { download: true })}
                  download={reportFileName("subjects", meta)}
                />
              }
              className="cursor-pointer"
            >
              All subjects
            </DropdownMenuItem>
            {uniqueSubjects.map((subject) => (
              <DropdownMenuItem
                key={subject}
                render={
                  <a
                    href={studentReportCardHref(portal, studentId, "subjects", {
                      download: true,
                      subject,
                    })}
                    download={reportFileName("subjects", meta, { subject })}
                  />
                }
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
