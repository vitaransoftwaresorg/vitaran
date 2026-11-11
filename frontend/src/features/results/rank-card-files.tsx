"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Award, Download, Eye, FileText, X } from "lucide-react";
import { SharePdfButton } from "@/components/shared/share-pdf-button";
import { Button } from "@/components/ui/button";
import { RESULTS_PATH } from "./constants";

/* eslint-disable @next/next/no-img-element -- authenticated proxy route, not a static asset */

/** `basePath` is the portal's results section; admin when omitted. */
type CardTarget = { resultSetId: string; classLevel: number; basePath?: string };

export function rankCardHref(target: CardTarget, options: { roll?: string; format: "pdf" | "jpg"; download?: boolean }) {
  const query = new URLSearchParams({
    set: target.resultSetId,
    class: String(target.classLevel),
    format: options.format,
  });
  if (options.roll) query.set("roll", options.roll);
  if (options.download) query.set("download", "1");
  return `${target.basePath ?? RESULTS_PATH}/rank-cards?${query}`;
}

/** View / download one student's rank card. */
export function RankCardCell({
  target,
  roll,
  name,
}: {
  target: CardTarget | null;
  roll: string;
  name: string;
}) {
  if (!target || !roll) return <span className="text-neutral-300">—</span>;
  return (
    <div className="flex items-center justify-center gap-1">
      <Dialog.Root>
        <Dialog.Trigger
          title="View rank card"
          className="inline-flex size-8 items-center justify-center rounded-md text-violet-700 hover:bg-violet-50"
        >
          <Eye className="size-4" />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/70 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-[60] flex h-[94vh] w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-white shadow-2xl outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <header className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
              <Dialog.Title className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
                Rank card · {name} · {roll}
              </Dialog.Title>
              <a
                href={rankCardHref(target, { roll, format: "pdf", download: true })}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                <Download className="size-3.5" />
                Download PDF
              </a>
              <SharePdfButton
                href={rankCardHref(target, { roll, format: "pdf", download: true })}
                fileName={`${roll}-rank-card.pdf`}
                title={`rank card of ${name}`}
                preload
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 [&_svg]:size-3.5"
              >
                Share
              </SharePdfButton>
              <Dialog.Close
                aria-label="Close"
                className="inline-flex size-8 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="size-4" />
              </Dialog.Close>
            </header>
            <div className="min-h-0 flex-1 bg-neutral-100 p-3">
              <img
                src={rankCardHref(target, { roll, format: "jpg" })}
                alt={`Rank card of ${name}`}
                className="size-full object-contain"
              />
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <a
        href={rankCardHref(target, { roll, format: "pdf", download: true })}
        title="Download rank card (PDF)"
        className="inline-flex size-8 items-center justify-center rounded-md text-violet-700 hover:bg-violet-50"
      >
        <Download className="size-4" />
      </a>
      <SharePdfButton
        href={rankCardHref(target, { roll, format: "pdf", download: true })}
        fileName={`${roll}-rank-card.pdf`}
        title={`rank card of ${name}`}
        className="inline-flex size-8 items-center justify-center rounded-md text-violet-700 hover:bg-violet-50 disabled:opacity-60 [&_svg]:size-4"
      />
    </div>
  );
}

export function classResultHref(target: CardTarget, download = false) {
  const query = new URLSearchParams({ set: target.resultSetId, class: String(target.classLevel) });
  if (download) query.set("download", "1");
  return `${target.basePath ?? RESULTS_PATH}/class-pdf?${query}`;
}

/** The class result in rank order on A4, for printing and pinning on the notice board. */
export function ClassResultPdfDownload({ target }: { target: CardTarget | null }) {
  if (!target) {
    return (
      <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" disabled title="Save results first">
        <FileText />
        Result PDF
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-lg"
        title="Class result for the notice board (PDF)"
        nativeButton={false}
        render={<a href={classResultHref(target, true)} />}
      >
        <FileText />
        Result PDF
      </Button>
      <SharePdfButton
        href={classResultHref(target, true)}
        fileName={`Class-${target.classLevel}-results.pdf`}
        title={`Class ${target.classLevel} results`}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-input bg-background text-brand-800 hover:bg-brand-50 disabled:opacity-60 [&_svg]:size-4"
      />
    </div>
  );
}

/** Whole class as one PDF, one rank card per page in rank order. */
export function ClassRankCardsDownload({ target }: { target: CardTarget | null }) {
  if (!target) {
    return (
      <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" disabled title="Save results first">
        <Award />
        Rank cards
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-lg"
        nativeButton={false}
        render={<a href={rankCardHref(target, { format: "pdf", download: true })} />}
      >
        <Award />
        Rank cards
      </Button>
      <SharePdfButton
        href={rankCardHref(target, { format: "pdf", download: true })}
        fileName={`Class-${target.classLevel}-rank-cards.pdf`}
        title={`Class ${target.classLevel} rank cards`}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-input bg-background text-violet-700 hover:bg-violet-50 disabled:opacity-60 [&_svg]:size-4"
      />
    </div>
  );
}
