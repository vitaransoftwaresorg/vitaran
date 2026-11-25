"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ImageZoomPane } from "@/components/shared/image-zoom-pane";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ScanPortal } from "@/services/scans";
import { formatMarks, type ScanPreview } from "@/types/scan";
import { previewScanAction } from "./actions";
import { getScanBatch, setScanBatch, type PdfFailure } from "./batch-store";
import { asJpegFile } from "./camera";
import { fetchOriginalSheetDirect, fetchPreviewSheetDirect } from "./client-upload";
import { OmrRollRecovery } from "./omr-roll-recovery";
import type { OmrStudentMatch } from "./omr-student-actions";
import { fetchFailedPageImage, resolvePdfFailure } from "./pdf-batch";
import {
  canRecoverRoll,
  displayScanError,
  isDuplicateRollError,
  ROLL_LENGTH,
  rollInput,
} from "./roll-helpers";
import { getOmrUploadAuthAction } from "./upload-auth";

const NO_MATCHES: OmrStudentMatch[] = [];

function triggerDownload(url: string, filename: string, revoke = false) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (revoke) URL.revokeObjectURL(url);
}

async function downloadReadyOmr(portal: ScanPortal, item: ScanPreview) {
  const roll = item.scan.student.rollNo || "sheet";
  const page = item.pdfPage != null ? `-p${item.pdfPage}` : "";
  const filename = `OMR-${roll}${page}.jpg`;
  if (item.scan.sheetImage) {
    triggerDownload(item.scan.sheetImage, filename);
    return;
  }
  const auth = await getOmrUploadAuthAction(portal);
  if (!auth.ok) throw new Error(auth.message);
  const url = await fetchPreviewSheetDirect(auth.previewsUrl, auth.token, item.previewId, "preview");
  triggerDownload(url, filename, true);
}

async function downloadFailedOmr(portal: ScanPortal, failure: PdfFailure) {
  const roll = failure.rollNo?.trim() || "page";
  const filename = `OMR-${roll}-p${failure.page}.jpg`;
  const url = await fetchFailedPageImage(failure.page, portal);
  triggerDownload(url, filename, true);
}

type ReadyView = { kind: "ready"; item: ScanPreview };
type FailedView = { kind: "failed"; failure: PdfFailure };
type Viewing = ReadyView | FailedView;

type UnifiedRow =
  | { kind: "ready"; sort: number; item: ScanPreview }
  | { kind: "failed"; sort: number; failure: PdfFailure };

function buildRows(batch: ScanPreview[], failures: PdfFailure[]): UnifiedRow[] {
  const ready: UnifiedRow[] = batch.map((item) => ({
    kind: "ready",
    sort: item.pdfPage ?? 10_000,
    item,
  }));
  const failed: UnifiedRow[] = failures.map((failure) => ({
    kind: "failed",
    sort: failure.page,
    failure,
  }));
  return [...ready, ...failed].sort((a, b) => {
    if (a.sort !== b.sort) return a.sort - b.sort;
    if (a.kind === b.kind) return 0;
    return a.kind === "failed" ? -1 : 1;
  });
}

/** Failed (red) + ready (green) in one table — Save one or Save all. */
export function ScanSheetTable({
  portal,
  testId,
  examPattern,
  batch,
  failures,
  saving,
  savingAll,
  onSaveOne,
  onSaveAll,
  onOpenReview,
}: {
  portal: ScanPortal;
  testId: string;
  examPattern: string;
  batch: ScanPreview[];
  failures: PdfFailure[];
  saving: Set<string>;
  savingAll: boolean;
  onSaveOne: (item: ScanPreview) => void;
  onSaveAll: () => void;
  onOpenReview: (index: number) => void;
}) {
  const rows = useMemo(() => buildRows(batch, failures), [batch, failures]);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [savingPage, setSavingPage] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [pageMatches, setPageMatches] = useState<Record<number, OmrStudentMatch[]>>({});
  const [pageRollHints, setPageRollHints] = useState<Record<number, string>>({});

  async function handleDownloadReady(item: ScanPreview) {
    const key = item.previewId;
    setDownloading(key);
    try {
      await downloadReadyOmr(portal, item);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download this OMR.");
    } finally {
      setDownloading((current) => (current === key ? null : current));
    }
  }

  async function handleDownloadFailed(failure: PdfFailure) {
    const key = `failed-${failure.page}`;
    setDownloading(key);
    try {
      await downloadFailedOmr(portal, failure);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download this OMR.");
    } finally {
      setDownloading((current) => (current === key ? null : current));
    }
  }

  async function saveFailedWithRoll(
    failure: PdfFailure,
    typedRoll: string,
    schoolId?: string,
    studentName?: string,
  ) {
    if (!failure.hasImage) {
      toast.error("No page image to save.");
      return;
    }
    const typed = rollInput(typedRoll);
    if (typed.length !== ROLL_LENGTH) {
      toast.error("Enter the 7-digit registration number, then save.");
      return;
    }
    setSavingPage(failure.page);
    try {
      const url = await fetchFailedPageImage(failure.page, portal);
      const blob = await fetch(url).then((response) => response.blob());
      URL.revokeObjectURL(url);
      const form = new FormData();
      form.append("file", await asJpegFile(blob));
      form.append("testId", testId);
      form.append("examPattern", examPattern);
      form.append("rollNo", typed);
      if (schoolId) form.append("schoolId", schoolId);
      if (studentName?.trim()) form.append("studentName", studentName.trim());
      const result = await previewScanAction(portal, form);
      if (!result.ok) {
        toast.error(`Page ${failure.page}: ${result.message}`);
        if (result.matches?.length) {
          setPageMatches((prev) => ({ ...prev, [failure.page]: result.matches ?? [] }));
          setPageRollHints((prev) => ({
            ...prev,
            [failure.page]: result.rollNo ?? typed,
          }));
        }
        return;
      }
      const reg = result.result.scan.student.rollNo;
      if (getScanBatch().some((item) => item.scan.student.rollNo === reg)) {
        toast.warning(
          `Page ${failure.page}: Reg ${reg} is already in the list. Enter a different registration.`,
        );
        return;
      }
      setScanBatch([...getScanBatch(), { ...result.result, pdfPage: failure.page }]);
      resolvePdfFailure(failure.page);
      setPageMatches((prev) => {
        const next = { ...prev };
        delete next[failure.page];
        return next;
      });
      setViewing(null);
      toast.success(`PDF page ${failure.page} ready · ${result.result.scan.student.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this page.");
    } finally {
      setSavingPage(null);
    }
  }

  const readyCount = batch.length;
  const failedCount = failures.length;

  return (
    <div>
      {(readyCount > 0 || failedCount > 0) && !savingAll ? (
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50/60 px-4 py-2">
          <p className="text-sm text-neutral-600">
            {readyCount > 0 ? (
              <span className="font-semibold text-emerald-800">{readyCount} ready</span>
            ) : null}
            {readyCount > 0 && failedCount > 0 ? <span className="text-neutral-300"> · </span> : null}
            {failedCount > 0 ? (
              <span className="font-semibold text-red-700">{failedCount} failed</span>
            ) : null}
          </p>
          {readyCount > 0 ? (
            <Button
              type="button"
              size="sm"
              onClick={onSaveAll}
              disabled={savingAll || saving.size > 0}
            >
              Save all ({readyCount})
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="max-h-[42rem] overflow-auto">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-neutral-100 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
            <tr>
              <th className="whitespace-nowrap px-3 py-2">Page</th>
              <th className="px-3 py-2">Student / error</th>
              <th className="min-w-[14rem] px-3 py-2">Registration number</th>
              <th className="whitespace-nowrap px-3 py-2">Score</th>
              <th className="whitespace-nowrap px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.kind === "ready") {
                const item = row.item;
                const scan = item.scan;
                const busy = savingAll || saving.has(item.previewId);
                return (
                  <tr
                    key={`ready-${item.previewId}`}
                    className="border-t border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50"
                  >
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-emerald-900">
                      {item.pdfPage != null ? item.pdfPage : "—"}
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-1.5 font-medium text-emerald-950">
                      {scan.student.name}
                      <span className="ml-1.5 font-normal text-emerald-800/70">
                        Class {scan.student.classLevel}-{scan.student.sectionName?.trim() || "A"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-emerald-900">
                      {scan.student.rollNo}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-semibold tabular-nums text-emerald-900">
                      {formatMarks(scan.total)}/{formatMarks(scan.maxTotal)}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-emerald-300 px-2 text-xs text-emerald-900"
                          onClick={() => setViewing({ kind: "ready", item })}
                          disabled={savingAll}
                        >
                          <Eye className="size-3.5" />
                          View OMR
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 border-emerald-300 px-2 text-xs text-emerald-900"
                          disabled={savingAll}
                          onClick={() => {
                            const index = getScanBatch().findIndex(
                              (row) => row.previewId === item.previewId,
                            );
                            if (index >= 0) onOpenReview(index);
                          }}
                        >
                          View details
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-emerald-300 px-2 text-xs text-emerald-900"
                          disabled={savingAll || downloading === item.previewId}
                          onClick={() => void handleDownloadReady(item)}
                        >
                          {downloading === item.previewId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5" />
                          )}
                          Download
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 bg-emerald-700 px-2.5 text-xs hover:bg-emerald-800"
                          disabled={busy}
                          onClick={() => onSaveOne(item)}
                        >
                          {saving.has(item.previewId) ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : null}
                          Save
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }

              const failure = row.failure;
              const recoverRoll = canRecoverRoll(failure.message);
              const isDup = isDuplicateRollError(failure.message);
              const busy = savingAll || savingPage === failure.page;
              return (
                <tr
                  key={`failed-${failure.page}`}
                  className="border-t border-red-100 bg-red-50/60 hover:bg-red-50"
                >
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-red-900">
                    {failure.page}
                  </td>
                  <td className="max-w-[18rem] px-3 py-1.5 text-xs leading-snug text-red-800">
                    {isDup ? "Duplicate registration" : displayScanError(failure.message)}
                  </td>
                  <td className="px-3 py-1">
                    {recoverRoll && failure.hasImage ? (
                      <OmrRollRecovery
                        portal={portal}
                        message={failure.message}
                        busy={busy}
                        inputId={`omr-recovery-roll-${failure.page}`}
                        initialMatches={pageMatches[failure.page] ?? NO_MATCHES}
                        initialRollNo={
                          pageRollHints[failure.page] ?? failure.rollNo?.trim() ?? ""
                        }
                        onSaveWithRoll={(roll, schoolId, studentName) =>
                          void saveFailedWithRoll(failure, roll, schoolId, studentName)
                        }
                      />
                    ) : recoverRoll && !failure.hasImage ? (
                      <span className="text-[11px] text-red-800">No page image</span>
                    ) : (
                      <span className="whitespace-nowrap tabular-nums text-red-800/80">
                        {failure.rollNo?.trim() || "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-red-800/40">—</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {failure.hasImage ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 border-red-300 px-2 text-xs text-red-900"
                            onClick={() => setViewing({ kind: "failed", failure })}
                          >
                            <Eye className="size-3.5" />
                            View OMR
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 border-red-300 px-2 text-xs text-red-900"
                            disabled={downloading === `failed-${failure.page}`}
                            onClick={() => void handleDownloadFailed(failure)}
                          >
                            {downloading === `failed-${failure.page}` ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Download className="size-3.5" />
                            )}
                            Download
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet open={viewing != null} onOpenChange={(open) => (open ? null : setViewing(null))}>
        <SheetContent
          side="right"
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-1/2 data-[side=right]:sm:max-w-[50vw]"
        >
          {viewing?.kind === "ready" ? (
            <>
              <SheetHeader className="shrink-0 border-b border-neutral-100 px-4 py-3">
                <SheetTitle>{viewing.item.scan.student.name}</SheetTitle>
                <p className="text-sm font-semibold text-neutral-800">
                  {viewing.item.scan.student.programName}
                  {" · "}
                  Class {viewing.item.scan.student.classLevel}-
                  {viewing.item.scan.student.sectionName?.trim() || "A"}
                </p>
                <p className="text-sm text-neutral-600">
                  {viewing.item.pdfPage != null ? `PDF page ${viewing.item.pdfPage} · ` : ""}
                  Reg {viewing.item.scan.student.rollNo} ·{" "}
                  {formatMarks(viewing.item.scan.total)}/{formatMarks(viewing.item.scan.maxTotal)}
                </p>
              </SheetHeader>
              <div className="min-h-0 flex-1">
                <ReadySheetImage
                  key={viewing.item.previewId}
                  portal={portal}
                  previewId={viewing.item.previewId}
                  marked={viewing.item.scan.sheetImage}
                  label={
                    viewing.item.pdfPage != null
                      ? `PDF page ${viewing.item.pdfPage}`
                      : viewing.item.scan.student.name
                  }
                />
              </div>
              <div className="flex shrink-0 gap-2 border-t border-neutral-100 p-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={savingAll}
                  onClick={() => {
                    const index = getScanBatch().findIndex(
                      (item) => item.previewId === viewing.item.previewId,
                    );
                    setViewing(null);
                    if (index >= 0) onOpenReview(index);
                  }}
                >
                  View details
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-1.5"
                  disabled={savingAll || downloading === viewing.item.previewId}
                  onClick={() => void handleDownloadReady(viewing.item)}
                >
                  {downloading === viewing.item.previewId ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Download
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={savingAll || saving.has(viewing.item.previewId)}
                  onClick={() => onSaveOne(viewing.item)}
                >
                  {saving.has(viewing.item.previewId) ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Save
                </Button>
              </div>
            </>
          ) : viewing?.kind === "failed" ? (
            <>
              <SheetHeader className="shrink-0 border-b border-neutral-100 px-4 py-3">
                <SheetTitle>PDF page {viewing.failure.page}</SheetTitle>
                <p className="text-sm text-red-700">{displayScanError(viewing.failure.message)}</p>
              </SheetHeader>
              <div className="min-h-0 flex-1">
                <ImageZoomPane
                  key={viewing.failure.page}
                  className="h-full"
                  toolbarLeft={`PDF page ${viewing.failure.page}`}
                  resetKey={viewing.failure.page}
                >
                  <FailedPageImage page={viewing.failure.page} portal={portal} />
                </ImageZoomPane>
              </div>
              {canRecoverRoll(viewing.failure.message) && viewing.failure.hasImage ? (
                <div className="shrink-0 space-y-3 border-t border-neutral-100 p-4">
                  <OmrRollRecovery
                    portal={portal}
                    message={viewing.failure.message}
                    busy={savingAll || savingPage === viewing.failure.page}
                    inputId={`omr-recovery-sheet-roll-${viewing.failure.page}`}
                    initialMatches={pageMatches[viewing.failure.page] ?? NO_MATCHES}
                    initialRollNo={pageRollHints[viewing.failure.page] ?? ""}
                    onSaveWithRoll={(roll, schoolId, studentName) =>
                      void saveFailedWithRoll(viewing.failure, roll, schoolId, studentName)
                    }
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FailedPageImage({ page, portal }: { page: number; portal: ScanPortal }) {
  const [state, setState] = useState<{ url?: string; error?: string }>({});

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    fetchFailedPageImage(page, portal)
      .then((next) => {
        url = next;
        if (cancelled) URL.revokeObjectURL(next);
        else setState({ url: next });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ error: error instanceof Error ? error.message : "Could not load this page." });
        }
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [page, portal]);

  if (state.error) return <p className="py-10 text-center text-sm text-red-700">{state.error}</p>;
  if (!state.url) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-brand-700" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- blob URL from the scan API
  return (
    <img
      src={state.url}
      alt={`PDF page ${page}`}
      className="mx-auto block w-full max-w-full rounded-lg border border-neutral-200 bg-white object-contain"
      draggable={false}
    />
  );
}

function ReadySheetImage({
  portal,
  previewId,
  marked,
  label,
}: {
  portal: ScanPortal;
  previewId: string;
  marked?: string;
  label: string;
}) {
  const [view, setView] = useState<"marked" | "original">("marked");
  const [markedUrl, setMarkedUrl] = useState(marked ?? null);
  const [original, setOriginal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (marked) {
      setMarkedUrl(marked);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const auth = await getOmrUploadAuthAction(portal);
        if (!auth.ok || cancelled) return;
        const url = await fetchPreviewSheetDirect(auth.previewsUrl, auth.token, previewId, "preview");
        if (!cancelled) setMarkedUrl(url);
      } catch {
        // Placeholder until retry.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portal, previewId, marked]);

  async function showOriginal() {
    setView("original");
    if (original) return;
    setLoading(true);
    try {
      const auth = await getOmrUploadAuthAction(portal);
      if (!auth.ok) throw new Error(auth.message);
      const url = await fetchOriginalSheetDirect(auth.previewsUrl, auth.token, previewId);
      setOriginal(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the original OMR.");
      setView("marked");
    } finally {
      setLoading(false);
    }
  }

  const src = view === "original" ? original : markedUrl;
  const tab = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
      active ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500 hover:text-neutral-800",
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 justify-center border-b border-neutral-200 bg-white px-2 py-2">
        <div className="inline-flex rounded-lg bg-neutral-200/70 p-0.5">
          <button type="button" className={tab(view === "marked")} onClick={() => setView("marked")}>
            Evaluated
          </button>
          <button type="button" className={tab(view === "original")} onClick={() => void showOriginal()}>
            Original OMR
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-brand-700" />
        </div>
      ) : src ? (
        <ImageZoomPane
          className="min-h-0 flex-1"
          toolbarLeft={label}
          resetKey={`${previewId}:${view}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- blob / data URL from scan API */}
          <img
            src={src}
            alt={view === "original" ? "Original OMR sheet" : "Evaluated OMR sheet"}
            className="mx-auto block h-auto w-full object-contain"
            draggable={false}
          />
        </ImageZoomPane>
      ) : (
        <p className="flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">No sheet image</p>
      )}
    </div>
  );
}
