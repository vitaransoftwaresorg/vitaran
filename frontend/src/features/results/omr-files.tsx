"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronDown, Download, Eye, FileDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ClassScan } from "@/types/scan";
import { RESULTS_PATH } from "./constants";

/* eslint-disable @next/next/no-img-element -- authenticated proxy route, not a static asset */

type OmrKind = "preview" | "raw";

const KIND_LABEL: Record<OmrKind, string> = { preview: "Evaluated", raw: "Original" };

export function omrImageHref(scanId: string, kind: OmrKind, download = false) {
  return `${RESULTS_PATH}/omr/${encodeURIComponent(scanId)}?kind=${kind}${download ? "&download=1" : ""}`;
}

/** View / download buttons for one student's saved OMR. */
export function OmrCell({ scan }: { scan: ClassScan | undefined }) {
  const [kind, setKind] = useState<OmrKind>("preview");
  if (!scan) return <span className="text-neutral-300">—</span>;
  return (
    <div className="flex items-center justify-center gap-1">
      <Dialog.Root onOpenChange={(open) => open && setKind("preview")}>
        <Dialog.Trigger
          title="View OMR"
          className="inline-flex size-8 items-center justify-center rounded-md text-brand-900 hover:bg-brand-50"
        >
          <Eye className="size-4" />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/70 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-[60] flex h-[92vh] w-[94vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-white shadow-2xl outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
              <Dialog.Title className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
                {scan.studentName} · {scan.rollNo}
              </Dialog.Title>
              <div className="flex rounded-lg border border-neutral-200 p-0.5">
                {(["preview", "raw"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setKind(option)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-semibold",
                      kind === option ? "bg-brand-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
                    )}
                  >
                    {KIND_LABEL[option]}
                  </button>
                ))}
              </div>
              <a
                href={omrImageHref(scan.id, kind, true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                <Download className="size-3.5" />
                Download
              </a>
              <Dialog.Close
                aria-label="Close"
                className="inline-flex size-8 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="size-4" />
              </Dialog.Close>
            </header>
            <div className="min-h-0 flex-1 p-3">
              <img
                key={kind}
                src={omrImageHref(scan.id, kind)}
                alt={`${KIND_LABEL[kind]} OMR of ${scan.studentName}`}
                className="size-full object-contain"
              />
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <a
        href={omrImageHref(scan.id, "preview", true)}
        title="Download evaluated OMR"
        className="inline-flex size-8 items-center justify-center rounded-md text-brand-900 hover:bg-brand-50"
      >
        <Download className="size-4" />
      </a>
    </div>
  );
}

/** Whole class as one PDF, rank order, one sheet per page. */
export function ClassOmrDownload({
  path,
  count,
}: {
  path: { schoolId: string; testNumber: number; classLevel: number; program?: string };
  count: number;
}) {
  const href = (kind: OmrKind) => {
    const query = new URLSearchParams({
      school: path.schoolId,
      test: String(path.testNumber),
      class: String(path.classLevel),
      kind,
      download: "1",
    });
    if (path.program) query.set("program", path.program);
    return `${RESULTS_PATH}/omr/class?${query}`;
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={count === 0}
        render={
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg">
            <FileDown />
            OMRs ({count})
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => window.location.assign(href("preview"))}>
          Evaluated OMRs (PDF)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.location.assign(href("raw"))}>
          Original OMRs (PDF)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
