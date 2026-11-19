"use client";

import { useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { SharePdfButton } from "@/components/shared/share-pdf-button";
import { printPdf } from "@/features/answer-keys/print-pdf";
import { cn } from "@/lib/utils";
import { downloadFileName } from "@/utils/download-file-name";
import type { PerformancePortal } from "./performance-actions";

const PROFILE_BASE: Record<PerformancePortal, string> = {
  admin: "/admin/schools/students",
  school: "/school/students",
  teacher: "/teacher/students",
};

export const studentPdfHref = (portal: PerformancePortal, id: string, download = false) =>
  `${PROFILE_BASE[portal]}/${encodeURIComponent(id)}/pdf${download ? "?download=1" : ""}`;

/** Print and download the branded student profile PDF (on the dark profile header). */
export function StudentPdfActions({
  portal,
  studentId,
  studentName,
  rollNo,
  schoolName,
  programName,
  classLevel,
  outlineClassName,
}: {
  portal: PerformancePortal;
  studentId: string;
  studentName?: string;
  rollNo?: string;
  schoolName?: string;
  programName?: string;
  classLevel?: number;
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

export const classProfilesPdfHref = (portal: PerformancePortal, studentIds: string[], download = false) =>
  `${PROFILE_BASE[portal]}/profiles/pdf?ids=${studentIds.map(encodeURIComponent).join(",")}${download ? "&download=1" : ""}`;

const CLASS_BUTTON =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors [&_svg]:size-3.5";

/** Print or download every listed student's profile card as one PDF (one student per page). */
export function ClassProfilesPdfActions({
  portal,
  studentIds,
  label = "profile cards",
  scopeLabel,
  schoolName,
  className,
}: {
  portal: PerformancePortal;
  studentIds: string[];
  label?: string;
  /** e.g. "Class 8-A" — used in the download filename. */
  scopeLabel?: string;
  schoolName?: string;
  className?: string;
}) {
  const [printing, setPrinting] = useState(false);
  if (studentIds.length === 0) return null;
  const title = `${studentIds.length} student profile ${studentIds.length === 1 ? "card" : "cards"}`;
  const fileName = downloadFileName(
    ["Student-Profiles", schoolName, scopeLabel ?? label],
    "pdf",
  );

  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        title={`Print ${title}`}
        disabled={printing}
        onClick={() => {
          setPrinting(true);
          printPdf(classProfilesPdfHref(portal, studentIds), () => setPrinting(false), fileName);
        }}
        className={cn(
          CLASS_BUTTON,
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
        className={cn(CLASS_BUTTON, "bg-brand-900 text-white hover:bg-brand-800 active:scale-[0.98]")}
      >
        <Download />
        PDF
      </a>
      <SharePdfButton
        href={classProfilesPdfHref(portal, studentIds, true)}
        fileName={fileName}
        title={title}
        className={cn(
          CLASS_BUTTON,
          "border border-brand-200 bg-white text-brand-900 hover:border-brand-900 hover:bg-brand-50 disabled:opacity-60",
        )}
      >
        Share
      </SharePdfButton>
    </div>
  );
}
