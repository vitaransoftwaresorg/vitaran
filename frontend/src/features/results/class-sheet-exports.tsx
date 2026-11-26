"use client";

import { useState } from "react";
import { Award, ChevronDown, Download, FileDown, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { printPdf } from "@/features/answer-keys/print-pdf";
import { downloadFileName } from "@/utils/download-file-name";
import { RESULTS_PATH } from "./constants";
import { classResultHref, rankCardHref } from "./rank-card-files";

type CardTarget = {
  resultSetId: string;
  classLevel: number;
  basePath?: string;
  schoolName?: string;
  programLabel?: string;
  testNumber?: number;
  testId?: string;
};

type OmrPath = {
  schoolId: string;
  testNumber: number;
  classLevel: number;
  program?: string;
};

function openDownload(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

/**
 * One Export control for class result sheets — keeps mobile toolbars usable.
 */
export function ClassSheetExports({
  target,
  omr,
  omrCount,
  excelHref,
  showExcel = false,
}: {
  target: CardTarget | null;
  omr?: OmrPath | null;
  omrCount?: number;
  excelHref?: string;
  showExcel?: boolean;
}) {
  const [printing, setPrinting] = useState<"results" | "cards" | null>(null);
  const disabled = !target;
  const basePath = target?.basePath ?? RESULTS_PATH;
  const cardsHref = target ? rankCardHref(target, { format: "pdf" }) : "#";
  const cardsDownload = target ? rankCardHref(target, { format: "pdf", download: true }) : "#";
  const resultHref = target ? classResultHref(target, true) : "#";
  const resultName = target
    ? downloadFileName(
        [
          "Results",
          target.schoolName,
          target.programLabel,
          `Class-${target.classLevel}`,
          target.testNumber != null ? `Test-${target.testNumber}` : null,
          target.testId,
        ],
        "pdf",
      )
    : "results.pdf";
  const cardsName = target
    ? downloadFileName(
        [
          "Report-Cards",
          target.schoolName,
          target.programLabel,
          `Class-${target.classLevel}`,
          target.testNumber != null ? `Test-${target.testNumber}` : null,
          target.testId,
        ],
        "pdf",
      )
    : "report-cards.pdf";

  const omrHref = (kind: "preview" | "raw") => {
    if (!omr) return "#";
    const query = new URLSearchParams({
      school: omr.schoolId,
      test: String(omr.testNumber),
      class: String(omr.classLevel),
      kind,
      download: "1",
    });
    if (omr.program) query.set("program", omr.program);
    return `${basePath}/omr/class?${query}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled && !(showExcel && excelHref)}
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-lg"
            title={disabled ? "Save results first" : "Export class files"}
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-52">
        {showExcel && excelHref ? (
          <>
            <DropdownMenuItem onClick={() => openDownload(excelHref)}>
              <FileDown className="size-4" />
              Excel spreadsheet
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          disabled={disabled}
          onClick={() => {
            if (!target) return;
            setPrinting("results");
            printPdf(resultHref, () => setPrinting(null), resultName);
          }}
        >
          {printing === "results" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Printer className="size-4" />
          )}
          Print result PDF
        </DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onClick={() => openDownload(resultHref)}>
          <FileText className="size-4" />
          Download result PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={disabled}
          onClick={() => {
            if (!target) return;
            setPrinting("cards");
            printPdf(cardsHref, () => setPrinting(null), cardsName);
          }}
        >
          {printing === "cards" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Printer className="size-4" />
          )}
          Print report cards
        </DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onClick={() => openDownload(cardsDownload)}>
          <Award className="size-4" />
          Download report cards
        </DropdownMenuItem>
        {omr ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!omrCount}
              onClick={() => window.location.assign(omrHref("preview"))}
            >
              <FileDown className="size-4" />
              Evaluated OMRs ({omrCount ?? 0})
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!omrCount}
              onClick={() => window.location.assign(omrHref("raw"))}
            >
              <FileDown className="size-4" />
              Original OMRs ({omrCount ?? 0})
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
