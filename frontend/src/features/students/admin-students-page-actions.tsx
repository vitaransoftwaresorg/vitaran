"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { subjectsForClassLevel } from "@/features/schools/constants";
import { cn } from "@/lib/utils";
import { downloadFileName } from "@/utils/download-file-name";
import { AdminStudentRollSearch } from "./admin-student-roll-search";
import { DeleteRosterStudentsButton } from "./delete-roster-students-button";
import {
  classProfilesPdfHref,
  classReportCardsHref,
  ClassProfilesPdfActions,
  type PerformancePortal,
  type ReportCardKind,
} from "./student-pdf-actions";
import { downloadReportPdf, emptyReportMessage } from "./report-download";
import { REPORT_TEST_NUMBERS } from "./portal";

type AdminStudentsPageActionsProps = {
  schoolId?: string;
  schoolName?: string;
  classLevel?: number;
  section?: string;
  /** True when a class (and section if required) roster is in view. */
  inClass: boolean;
  classScopeLabel?: string;
  studentIds: string[];
  canDeleteRoster: boolean;
  sectionId?: string | null;
  studentCount: number;
  showImportAll: boolean;
  addStudentsHref?: string;
};

const titleCase = (label: string) =>
  label.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());

/**
 * Students page toolbar: search + Add always visible; other actions collapse into
 * a More menu on mobile so the header stays usable.
 */
export function AdminStudentsPageActions({
  schoolId,
  schoolName,
  classLevel,
  section,
  inClass,
  classScopeLabel,
  studentIds,
  canDeleteRoster,
  sectionId,
  studentCount,
  showImportAll,
  addStudentsHref,
}: AdminStudentsPageActionsProps) {
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const portal: PerformancePortal = "admin";
  const subjects =
    classLevel != null ? subjectsForClassLevel(classLevel) : [];
  const uniqueSubjects = [
    ...new Set(subjects.map((row) => row.trim().toUpperCase()).filter(Boolean)),
  ];
  const uniqueTests = [...REPORT_TEST_NUMBERS];

  const showClassExtras = Boolean(schoolId && inClass && classLevel != null);
  const showPdf = showClassExtras && studentIds.length > 0 && Boolean(classScopeLabel);
  const showDelete = showClassExtras && canDeleteRoster && studentCount > 0;
  const hasMore = showPdf || showDelete || showImportAll;

  function download(kind: ReportCardKind, options?: { subject?: string; test?: number }) {
    if (!classScopeLabel) return;
    const href = classReportCardsHref(portal, studentIds, kind, { download: true, ...options });
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
    const name = downloadFileName([prefix, schoolName, classScopeLabel], "pdf");
    startTransition(async () => {
      try {
        await downloadReportPdf(href, name);
      } catch {
        toast.error(emptyReportMessage(kind, options));
      }
    });
  }

  const profilesFileName = downloadFileName(
    ["Student-Profiles", schoolName, classScopeLabel],
    "pdf",
  );

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <AdminStudentRollSearch schoolId={schoolId} />

      {addStudentsHref ? (
        <Link
          href={addStudentsHref}
          className={cn(buttonVariants({ size: "sm" }), "h-8 gap-1.5 rounded-lg")}
        >
          <Plus className="size-4" />
          Add students
        </Link>
      ) : null}

      {/* Desktop: full action row */}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {showPdf && classScopeLabel ? (
          <ClassProfilesPdfActions
            portal={portal}
            studentIds={studentIds}
            scopeLabel={classScopeLabel}
            schoolName={schoolName}
            subjects={subjects}
          />
        ) : null}
        {showDelete && schoolId && classLevel != null ? (
          <DeleteRosterStudentsButton
            mode="admin"
            schoolId={schoolId}
            classLevel={classLevel}
            sectionId={sectionId}
            sectionLabel={section}
            studentCount={studentCount}
          />
        ) : null}
        {showImportAll && schoolId ? (
          <Link
            href={`/admin/schools/${schoolId}/students/import`}
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "h-8 gap-1.5 rounded-lg",
            )}
          >
            <FileSpreadsheet className="size-4" />
            Import all students
          </Link>
        ) : null}
      </div>

      {/* Mobile: overflow actions in one menu */}
      {hasMore ? (
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "h-8 gap-1.5 rounded-lg",
              )}
            >
              <MoreHorizontal className="size-4" />
              More
              <ChevronDown className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {showPdf && classScopeLabel ? (
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Downloads</DropdownMenuLabel>
                  <DropdownMenuItem
                    render={
                      <a
                        href={classProfilesPdfHref(portal, studentIds, true)}
                        download={profilesFileName}
                      />
                    }
                    className="cursor-pointer"
                  >
                    <Download />
                    Profiles
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={pending}
                    onClick={() => download("year")}
                    className="cursor-pointer"
                  >
                    {pending ? <Loader2 className="animate-spin" /> : <Download />}
                    Year Report
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <Download />
                      Tests Report
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 min-w-40 overflow-y-auto">
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
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <Download />
                      Subjects Report
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-44">
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
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
              ) : null}

              {showPdf && (showDelete || showImportAll) ? <DropdownMenuSeparator /> : null}

              {showImportAll && schoolId ? (
                <DropdownMenuItem
                  render={<Link href={`/admin/schools/${schoolId}/students/import`} />}
                  className="cursor-pointer"
                >
                  <FileSpreadsheet />
                  Import all students
                </DropdownMenuItem>
              ) : null}

              {showDelete ? (
                <DropdownMenuItem
                  variant="destructive"
                  className="cursor-pointer"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 />
                  {sectionId ? "Delete section" : "Delete class"}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {showDelete && schoolId && classLevel != null ? (
            <DeleteRosterStudentsButton
              mode="admin"
              schoolId={schoolId}
              classLevel={classLevel}
              sectionId={sectionId}
              sectionLabel={section}
              studentCount={studentCount}
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              hideTrigger
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
