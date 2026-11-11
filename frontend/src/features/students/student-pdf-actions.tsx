"use client";

import { useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { SharePdfButton } from "@/components/shared/share-pdf-button";
import { printPdf } from "@/features/answer-keys/print-pdf";
import { cn } from "@/lib/utils";
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
  outlineClassName,
}: {
  portal: PerformancePortal;
  studentId: string;
  outlineClassName: string;
}) {
  const [printing, setPrinting] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={printing}
        className={outlineClassName}
        onClick={() => {
          setPrinting(true);
          printPdf(studentPdfHref(portal, studentId), () => setPrinting(false));
        }}
      >
        {printing ? <Loader2 className="animate-spin" /> : <Printer />}
        Print
      </button>
      <a href={studentPdfHref(portal, studentId, true)} className={outlineClassName}>
        <Download />
        PDF
      </a>
      <SharePdfButton
        href={studentPdfHref(portal, studentId, true)}
        fileName="student-profile.pdf"
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
  className,
}: {
  portal: PerformancePortal;
  studentIds: string[];
  label?: string;
  className?: string;
}) {
  const [printing, setPrinting] = useState(false);
  if (studentIds.length === 0) return null;
  const title = `${studentIds.length} student profile ${studentIds.length === 1 ? "card" : "cards"}`;

  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        title={`Print ${title}`}
        disabled={printing}
        onClick={() => {
          setPrinting(true);
          printPdf(classProfilesPdfHref(portal, studentIds), () => setPrinting(false));
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
        className={cn(CLASS_BUTTON, "bg-brand-900 text-white hover:bg-brand-800 active:scale-[0.98]")}
      >
        <Download />
        PDF
      </a>
      <SharePdfButton
        href={classProfilesPdfHref(portal, studentIds, true)}
        fileName="student-profile-cards.pdf"
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
