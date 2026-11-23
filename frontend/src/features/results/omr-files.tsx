"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronDown, Download, Eye, FileDown, Loader2, X } from "lucide-react";
import { ImageZoomPane } from "@/components/shared/image-zoom-pane";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getOmScanAction } from "@/features/scan/actions";
import { keyHasMcq, ReadVsKeyTable } from "@/features/scan/read-vs-key-table";
import { cn } from "@/lib/utils";
import type { ScanPortal } from "@/services/scans";
import type { ClassScan, OmScan } from "@/types/scan";
import { formatMarks } from "@/types/scan";
import { RESULTS_PATH } from "./constants";

/* eslint-disable @next/next/no-img-element -- authenticated proxy route, not a static asset */

type OmrKind = "preview" | "raw";

const KIND_LABEL: Record<OmrKind, string> = { preview: "Evaluated", raw: "Original" };

function omrSubjectLabel(scan: ClassScan) {
  const name = scan.studentName?.trim();
  return name ? `${name} · ${scan.rollNo}` : scan.rollNo;
}

/** Scale the whole Read vs key block to fit — measure at 100% first so nothing is clipped. */
function FitFixed({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const update = () => {
      // Measure at full size, then scale down so the table is never clipped.
      const previous = inner.style.transform;
      inner.style.transform = "none";
      const width = outer.clientWidth;
      const height = outer.clientHeight;
      const naturalWidth = Math.max(inner.scrollWidth, inner.offsetWidth);
      const naturalHeight = Math.max(inner.scrollHeight, inner.offsetHeight);
      inner.style.transform = previous;
      if (!width || !height || !naturalWidth || !naturalHeight) return;
      const next = Math.min(1, width / naturalWidth, height / naturalHeight);
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div ref={outerRef} className="relative h-full min-h-0 w-full overflow-hidden">
      <div
        ref={innerRef}
        className="absolute top-0 left-0 w-full origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

function portalFromBasePath(basePath: string): ScanPortal {
  if (basePath.startsWith("/school")) return "school";
  if (basePath.startsWith("/teacher")) return "teacher";
  return "admin";
}

export function omrImageHref(scanId: string, kind: OmrKind, download = false, basePath = RESULTS_PATH) {
  return `${basePath}/omr/${encodeURIComponent(scanId)}?kind=${kind}${download ? "&download=1" : ""}`;
}

/** View / download buttons for one student's saved OMR (results, student profile — not review). */
export function OmrCell({
  scan,
  basePath = RESULTS_PATH,
  viewOnly = false,
}: {
  scan: ClassScan | undefined;
  /** The portal's results section. */
  basePath?: string;
  /** Profile tables: one View OMR control (dialog still has evaluated + original). */
  viewOnly?: boolean;
}) {
  const [kind, setKind] = useState<OmrKind>("preview");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OmScan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !scan) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getOmScanAction(portalFromBasePath(basePath), scan.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setDetail(null);
        setError(result.message);
        return;
      }
      setDetail(result.scan);
    });
    return () => {
      cancelled = true;
    };
  }, [open, scan, basePath]);

  if (!scan) return <span className="text-neutral-300">—</span>;

  const showPartial = keyHasMcq(detail?.keyTypeRanges);

  return (
    <div className="flex items-center justify-center gap-1">
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setKind("preview");
          } else {
            setDetail(null);
            setError(null);
          }
        }}
      >
        <Dialog.Trigger
          title="View OMR"
          className={
            viewOnly
              ? "inline-flex h-8 items-center gap-1.5 rounded-md border border-brand-200 bg-white px-2.5 text-xs font-semibold text-brand-900 hover:bg-brand-50"
              : "inline-flex size-8 items-center justify-center rounded-md text-brand-900 hover:bg-brand-50"
          }
        >
          <Eye className="size-4" />
          {viewOnly ? "View OMR" : null}
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/70 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <Dialog.Popup className="fixed inset-2 z-[60] flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col rounded-xl bg-white shadow-2xl outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 sm:inset-3 sm:h-[calc(100dvh-1.5rem)] sm:w-[calc(100vw-1.5rem)]">
            <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
              <Dialog.Title className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
                {omrSubjectLabel(scan)}
                {detail ? (
                  <span className="ml-2 font-normal text-neutral-500 tabular-nums">
                    {formatMarks(detail.total)}/{formatMarks(detail.maxTotal)}
                  </span>
                ) : null}
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
                href={omrImageHref(scan.id, kind, true, basePath)}
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
            <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 lg:grid-cols-2">
              {/* OMR sheet — zoom/scroll only here; Read vs key stays fixed on the right. */}
              <ImageZoomPane
                className="rounded-xl border border-neutral-200 bg-neutral-50"
                toolbarLeft={`${KIND_LABEL[kind]} OMR`}
                resetKey={kind}
              >
                <img
                  key={kind}
                  src={omrImageHref(scan.id, kind, false, basePath)}
                  alt={`${KIND_LABEL[kind]} OMR · ${omrSubjectLabel(scan)}`}
                  className="mx-auto block h-auto w-full object-contain"
                  draggable={false}
                />
              </ImageZoomPane>
              <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
                {loading ? (
                  <div className="flex flex-1 items-center justify-center text-neutral-500">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                ) : error ? (
                  <p className="m-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {error}
                  </p>
                ) : detail ? (
                  <>
                    <dl
                      className={cn(
                        "grid shrink-0 gap-2 border-b border-neutral-100 p-3 text-center text-sm",
                        showPartial ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
                      )}
                    >
                      <div className="rounded-xl bg-neutral-50 px-2 py-2">
                        <dt className="text-xs text-neutral-500">Correct</dt>
                        <dd className="text-lg font-bold tabular-nums">{detail.correct}</dd>
                      </div>
                      {showPartial ? (
                        <div className="rounded-xl bg-neutral-50 px-2 py-2">
                          <dt className="text-xs text-neutral-500">Partial</dt>
                          <dd className="text-lg font-bold tabular-nums">{detail.partial ?? 0}</dd>
                        </div>
                      ) : null}
                      <div className="rounded-xl bg-neutral-50 px-2 py-2">
                        <dt className="text-xs text-neutral-500">Wrong</dt>
                        <dd className="text-lg font-bold tabular-nums">{detail.wrong}</dd>
                      </div>
                      <div className="rounded-xl bg-neutral-50 px-2 py-2">
                        <dt className="text-xs text-neutral-500">Blank</dt>
                        <dd className="text-lg font-bold tabular-nums">{detail.blank}</dd>
                      </div>
                    </dl>
                    <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
                      <FitFixed>
                        <ReadVsKeyTable
                          answers={detail.answers ?? {}}
                          keyAnswers={detail.keyAnswers}
                          keyTypeRanges={detail.keyTypeRanges}
                          ranges={detail.subjectScores}
                          className="[&_[data-table-scroll]]:overflow-visible"
                        />
                      </FitFixed>
                    </div>
                  </>
                ) : null}
              </aside>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      {viewOnly ? null : (
        <a
          href={omrImageHref(scan.id, "preview", true, basePath)}
          title="Download evaluated OMR"
          className="inline-flex size-8 items-center justify-center rounded-md text-brand-900 hover:bg-brand-50"
        >
          <Download className="size-4" />
        </a>
      )}
    </div>
  );
}

/** Whole class as one PDF, rank order, one sheet per page. */
export function ClassOmrDownload({
  path,
  count,
  basePath = RESULTS_PATH,
}: {
  path: { schoolId: string; testNumber: number; classLevel: number; program?: string };
  count: number;
  basePath?: string;
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
    return `${basePath}/omr/class?${query}`;
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
