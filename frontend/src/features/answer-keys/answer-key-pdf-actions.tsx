"use client";

import { useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { answerKeyPdfHref, printPdf } from "./print-pdf";

type AnswerKeyPdfActionsProps = {
  basePath: string;
  id: string;
  disabled?: boolean;
  className?: string;
};

const BUTTON =
  "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors md:flex-none";

/** Print and download the branded answer key PDF. */
export function AnswerKeyPdfActions({ basePath, id, disabled = false, className }: AnswerKeyPdfActionsProps) {
  const [printing, setPrinting] = useState(false);

  if (disabled) {
    return (
      <span className={cn("text-xs font-medium text-neutral-400", className)}>Answers not published yet</span>
    );
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        disabled={printing}
        onClick={() => {
          setPrinting(true);
          printPdf(answerKeyPdfHref(basePath, id), () => setPrinting(false));
        }}
        className={cn(
          BUTTON,
          "border border-brand-200 bg-white text-brand-900 hover:border-brand-900 hover:bg-brand-50 disabled:opacity-60",
        )}
      >
        {printing ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
        Print
      </button>
      <a
        href={answerKeyPdfHref(basePath, id, true)}
        className={cn(BUTTON, "bg-brand-900 text-white hover:bg-brand-800 active:scale-[0.98]")}
      >
        <Download className="size-4" />
        PDF
      </a>
    </div>
  );
}
