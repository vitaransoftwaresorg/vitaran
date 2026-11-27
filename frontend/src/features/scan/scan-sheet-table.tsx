"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Download, Eye, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { ImageZoomPane } from "@/components/shared/image-zoom-pane";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ScanPortal } from "@/services/scans";
import { formatMarks, type ScanPreview } from "@/types/scan";
import {
  bindPendingIdentityAction,
  previewScanAction,
  recoverPdfPageAction,
  type PreviewScanFailure,
} from "./actions";
import { getPdfJob, getScanBatch, majorityWalkInFromBatch, setScanBatch, type PdfFailure } from "./batch-store";
import { asJpegFile } from "./camera";
import { fetchOriginalSheetDirect, fetchPreviewSheetDirect } from "./client-upload";
import { OmrRollRecovery } from "./omr-roll-recovery";
import type { OmrStudentMatch } from "./omr-student-actions";
import { fetchFailedPageImage, resolvePdfFailure } from "./pdf-batch";
import {
  canRecoverRoll,
  displayScanError,
  isDuplicateRollError,
  normalizeRollNo,
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
  const [editingPreviewId, setEditingPreviewId] = useState<string | null>(null);
  const [editingFailurePage, setEditingFailurePage] = useState<number | null>(null);
  const [savingReadyId, setSavingReadyId] = useState<string | null>(null);
  const [readyMatches, setReadyMatches] = useState<Record<string, OmrStudentMatch[]>>({});

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

  async function saveReadyWithRoll(
    item: ScanPreview,
    typedRoll: string,
    schoolId?: string,
    studentName?: string,
    sectionId?: string,
    placement?: { classLevel?: number; programCode?: string },
  ) {
    const typed = rollInput(typedRoll);
    const walkIn = Boolean(studentName?.trim());
    if (!walkIn && typed.length !== ROLL_LENGTH) {
      toast.error("Enter the 7-digit registration number, then confirm.");
      return;
    }
    if (walkIn && typed.length > 0 && typed.length !== ROLL_LENGTH) {
      toast.error("Registration number must be 7 digits, or empty with a name");
      return;
    }
    setSavingReadyId(item.previewId);
    try {
      const batchPlace = majorityWalkInFromBatch();
      const batchSchoolId =
        schoolId || item.scan.student.schoolId || batchPlace.schoolId;
      const classLevel =
        placement?.classLevel ?? item.scan.student.classLevel ?? batchPlace.classLevel;
      const programCode =
        placement?.programCode ?? item.scan.student.programCode ?? batchPlace.programCode;
      const result = await bindPendingIdentityAction(portal, item.previewId, {
        rollNo: walkIn ? normalizeRollNo(typed) : typed,
        studentName: studentName?.trim() || undefined,
        schoolId: batchSchoolId || undefined,
        sectionId: sectionId?.trim() || undefined,
        classLevel: classLevel || undefined,
        programCode: programCode || undefined,
      });
      if (!result.ok) {
        toast.error(result.message);
        if (result.matches?.length) {
          setReadyMatches((prev) => ({ ...prev, [item.previewId]: result.matches ?? [] }));
        }
        return;
      }
      const next = result.result;
      setScanBatch(
        getScanBatch().map((row) =>
          row.previewId === item.previewId
            ? { ...next, pdfPage: item.pdfPage ?? next.pdfPage }
            : row,
        ),
      );
      setReadyMatches((prev) => {
        const copy = { ...prev };
        delete copy[item.previewId];
        return copy;
      });
      setEditingPreviewId(null);
      const updated = { ...next, pdfPage: item.pdfPage ?? next.pdfPage };
      setViewing((current) =>
        current?.kind === "ready" && current.item.previewId === item.previewId
          ? { kind: "ready", item: updated }
          : current,
      );
      const reg = next.scan.student.rollNo;
      toast.success(
        reg
          ? `Updated · ${next.scan.student.name} (Reg ${reg})`
          : `Updated · ${next.scan.student.name}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this sheet.");
    } finally {
      setSavingReadyId(null);
    }
  }

  async function saveFailedWithRoll(
    failure: PdfFailure,
    typedRoll: string,
    schoolId?: string,
    studentName?: string,
    sectionId?: string,
    placement?: { classLevel?: number; programCode?: string },
  ) {
    if (!failure.hasImage && !failure.previewId) {
      toast.error("No page image for this sheet.");
      return;
    }
    const typed = rollInput(typedRoll);
    const walkIn = Boolean(studentName?.trim());
    if (!walkIn && typed.length !== ROLL_LENGTH) {
      toast.error("Enter the 7-digit registration number, then confirm.");
      return;
    }
    if (walkIn && typed.length > 0 && typed.length !== ROLL_LENGTH) {
      toast.error("Registration number must be 7 digits, or empty with a name");
      return;
    }
    setSavingPage(failure.page);
    try {
      const batchPlace = majorityWalkInFromBatch();
      const batchSchoolId = schoolId || batchPlace.schoolId;
      const classLevel = placement?.classLevel ?? batchPlace.classLevel;
      const programCode = placement?.programCode ?? batchPlace.programCode;
      const identity = {
        rollNo: walkIn ? normalizeRollNo(typed) : typed,
        studentName: studentName?.trim() || undefined,
        schoolId: batchSchoolId || undefined,
        sectionId: sectionId?.trim() || undefined,
        classLevel: classLevel || undefined,
        programCode: programCode || undefined,
      };

      // Prefer bind-only recover when answers were already scored at scan.
      const job = getPdfJob();
      let result: { ok: true; result: ScanPreview } | PreviewScanFailure;
      if (failure.previewId && job?.batchId) {
        result = await recoverPdfPageAction(portal, job.batchId, failure.page, identity);
      } else {
        const url = await fetchFailedPageImage(failure.page, portal);
        const blob = await fetch(url).then((response) => response.blob());
        URL.revokeObjectURL(url);
        const form = new FormData();
        form.append("file", await asJpegFile(blob));
        form.append("testId", testId);
        if (examPattern) form.append("examPattern", examPattern);
        form.append("rollNo", identity.rollNo);
        form.append("flat", "1");
        form.append("upright", "1");
        if (identity.schoolId) form.append("schoolId", identity.schoolId);
        if (identity.studentName) form.append("studentName", identity.studentName);
        if (identity.sectionId) form.append("sectionId", identity.sectionId);
        if (identity.classLevel) form.append("classLevel", String(identity.classLevel));
        if (identity.programCode) form.append("programCode", identity.programCode);
        result = await previewScanAction(portal, form);
      }
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
      if (
        reg &&
        getScanBatch().some((item) => item.scan.student.rollNo === reg)
      ) {
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
      setEditingFailurePage(null);
      setViewing(null);
      toast.success(`PDF page ${failure.page} ready · ${result.result.scan.student.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not apply registration.");
    } finally {
      setSavingPage(null);
    }
  }

  const readyCount = batch.length;
  const failedCount = failures.length;
  const editingItem =
    editingPreviewId == null
      ? null
      : (batch.find((item) => item.previewId === editingPreviewId) ?? null);
  const editingFailure =
    editingFailurePage == null
      ? null
      : (failures.find((failure) => failure.page === editingFailurePage) ?? null);
  const viewingReady =
    viewing?.kind === "ready"
      ? (batch.find((item) => item.previewId === viewing.item.previewId) ?? viewing.item)
      : null;
  const viewingFailed =
    viewing?.kind === "failed"
      ? (failures.find((failure) => failure.page === viewing.failure.page) ?? viewing.failure)
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {(readyCount > 0 || failedCount > 0) && !savingAll ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50/60 px-4 py-2">
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

      {/*
        Viewport-capped list so short laptops always get a real scrollport.
        Nested flex-1 + overscroll-contain was trapping the wheel when height
        didn’t resolve (layout pane is overflow-y-auto, not a flex parent).
      */}
      <div className="min-h-0 min-w-0 max-h-[min(70dvh,calc(100dvh-13rem))] flex-1 overflow-x-hidden overflow-y-auto overscroll-y-auto [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
          <colgroup>
            <col className="w-12" />
            <col className="w-[28%]" />
            <col className="w-[18%]" />
            <col className="w-20" />
            <col />
          </colgroup>
          <thead className="sticky top-0 z-10 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
            <tr>
              <th className="whitespace-nowrap border-b border-neutral-200 bg-neutral-100 px-2 py-2">
                Page
              </th>
              <th className="border-b border-neutral-200 bg-neutral-100 px-2 py-2">
                Student / error
              </th>
              <th className="border-b border-neutral-200 bg-neutral-100 px-2 py-2">
                Reg no
              </th>
              <th className="whitespace-nowrap border-b border-neutral-200 bg-neutral-100 px-2 py-2">
                Score
              </th>
              <th className="whitespace-nowrap border-b border-neutral-200 bg-neutral-100 px-2 py-2 text-right">
                Actions
              </th>
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
                    <td className="px-2 py-1.5 tabular-nums text-emerald-900">
                      {item.pdfPage != null ? item.pdfPage : "—"}
                    </td>
                    <td className="truncate px-2 py-1.5 font-medium text-emerald-950">
                      {scan.student.name}
                      <span className="ml-1.5 font-normal text-emerald-800/70">
                        Class {scan.student.classLevel}-{scan.student.sectionName?.trim() || "A"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-emerald-900">
                      <div className="flex items-center gap-1.5">
                        <span className="whitespace-nowrap">{scan.student.rollNo || "—"}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 shrink-0 p-0 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950"
                          title="Edit registration / name"
                          disabled={savingAll || busy}
                          onClick={() => setEditingPreviewId(item.previewId)}
                        >
                          <Pencil className="size-3.5" />
                          <span className="sr-only">Edit registration</span>
                        </Button>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-semibold tabular-nums text-emerald-900">
                      {formatMarks(scan.total)}/{formatMarks(scan.maxTotal)}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-emerald-300 px-1.5 text-xs text-emerald-900 sm:px-2"
                          onClick={() => setViewing({ kind: "ready", item })}
                          disabled={savingAll}
                          title="View OMR"
                        >
                          <Eye className="size-3.5" />
                          <span className="hidden lg:inline">View OMR</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 border-emerald-300 px-1.5 text-xs text-emerald-900 sm:px-2"
                          disabled={savingAll}
                          title="View details"
                          onClick={() => {
                            const index = getScanBatch().findIndex(
                              (row) => row.previewId === item.previewId,
                            );
                            if (index >= 0) onOpenReview(index);
                          }}
                        >
                          <span className="lg:hidden">Details</span>
                          <span className="hidden lg:inline">View details</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-emerald-300 px-1.5 text-xs text-emerald-900 sm:px-2"
                          disabled={savingAll || downloading === item.previewId}
                          onClick={() => void handleDownloadReady(item)}
                          title="Download"
                        >
                          {downloading === item.previewId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5" />
                          )}
                          <span className="hidden lg:inline">Download</span>
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
              return (
                <tr
                  key={`failed-${failure.page}`}
                  className="border-t border-red-100 bg-red-50/60 hover:bg-red-50"
                >
                  <td className="px-2 py-1.5 tabular-nums text-red-900">{failure.page}</td>
                  <td className="truncate px-2 py-1.5 text-xs leading-snug text-red-800">
                    {isDup ? "Duplicate registration" : displayScanError(failure.message)}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-red-800/80">
                    {recoverRoll && !failure.hasImage && !failure.previewId ? (
                      <span className="text-[11px] text-red-800">No page image</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="whitespace-nowrap">{failure.rollNo?.trim() || "—"}</span>
                        {recoverRoll && (failure.hasImage || failure.previewId) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 shrink-0 p-0 text-red-800 hover:bg-red-100 hover:text-red-950"
                            title="Enter registration / name"
                            disabled={savingAll || savingPage === failure.page}
                            onClick={() => setEditingFailurePage(failure.page)}
                          >
                            <Pencil className="size-3.5" />
                            <span className="sr-only">Enter registration</span>
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-semibold tabular-nums text-red-900">
                    {failure.total != null && failure.maxTotal != null
                      ? `${formatMarks(failure.total)}/${formatMarks(failure.maxTotal)}`
                      : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {failure.hasImage || failure.previewId ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 border-red-300 px-1.5 text-xs text-red-900 sm:px-2"
                            onClick={() => setViewing({ kind: "failed", failure })}
                            title="View OMR"
                          >
                            <Eye className="size-3.5" />
                            <span className="hidden lg:inline">View OMR</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 border-red-300 px-1.5 text-xs text-red-900 sm:px-2"
                            disabled={downloading === `failed-${failure.page}`}
                            onClick={() => void handleDownloadFailed(failure)}
                            title="Download"
                          >
                            {downloading === `failed-${failure.page}` ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Download className="size-3.5" />
                            )}
                            <span className="hidden lg:inline">Download</span>
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

      <Dialog.Root
        open={editingItem != null || editingFailure != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPreviewId(null);
            setEditingFailurePage(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-[60] w-[min(28rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-4 shadow-2xl outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            {editingItem ? (
              <>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Dialog.Title className="text-sm font-semibold text-neutral-950">
                      Edit registration
                    </Dialog.Title>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {editingItem.scan.student.name}
                      {" · "}
                      {formatMarks(editingItem.scan.total)}/{formatMarks(editingItem.scan.maxTotal)}
                    </p>
                  </div>
                  <Dialog.Close
                    aria-label="Close"
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <X className="size-4" />
                  </Dialog.Close>
                </div>
                <OmrRollRecovery
                  portal={portal}
                  message="Edit registration"
                  editMode
                  busy={savingReadyId === editingItem.previewId || savingAll}
                  schoolId={editingItem.scan.student.schoolId}
                  inputId={`omr-edit-dialog-roll-${editingItem.previewId}`}
                  initialMatches={readyMatches[editingItem.previewId] ?? NO_MATCHES}
                  initialRollNo={editingItem.scan.student.rollNo}
                  initialStudentName={editingItem.scan.student.name}
                  placementHint={{
                    schoolId: editingItem.scan.student.schoolId,
                    classLevel: editingItem.scan.student.classLevel,
                    programCode: editingItem.scan.student.programCode,
                  }}
                  onSaveWithRoll={(roll, schoolId, studentName, sectionId, placement) =>
                    void saveReadyWithRoll(
                      editingItem,
                      roll,
                      schoolId,
                      studentName,
                      sectionId,
                      placement,
                    )
                  }
                />
              </>
            ) : editingFailure ? (
              <>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Dialog.Title className="text-sm font-semibold text-neutral-950">
                      Enter registration
                    </Dialog.Title>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      PDF page {editingFailure.page}
                      {editingFailure.total != null && editingFailure.maxTotal != null
                        ? ` · ${formatMarks(editingFailure.total)}/${formatMarks(editingFailure.maxTotal)}`
                        : ""}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-red-700">
                      {isDuplicateRollError(editingFailure.message)
                        ? "Duplicate registration"
                        : displayScanError(editingFailure.message)}
                    </p>
                  </div>
                  <Dialog.Close
                    aria-label="Close"
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <X className="size-4" />
                  </Dialog.Close>
                </div>
                <OmrRollRecovery
                  portal={portal}
                  message={editingFailure.message}
                  busy={savingAll || savingPage === editingFailure.page}
                  inputId={`omr-edit-dialog-failed-${editingFailure.page}`}
                  initialMatches={pageMatches[editingFailure.page] ?? NO_MATCHES}
                  initialRollNo={
                    pageRollHints[editingFailure.page] ?? editingFailure.rollNo?.trim() ?? ""
                  }
                  onSaveWithRoll={(roll, schoolId, studentName, sectionId, placement) =>
                    void saveFailedWithRoll(
                      editingFailure,
                      roll,
                      schoolId,
                      studentName,
                      sectionId,
                      placement,
                    )
                  }
                />
              </>
            ) : null}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Sheet open={viewing != null} onOpenChange={(open) => (open ? null : setViewing(null))}>
        <SheetContent
          side="right"
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-1/2 data-[side=right]:sm:max-w-[50vw]"
        >
          {viewingReady ? (
            <>
              <SheetHeader className="shrink-0 border-b border-neutral-100 px-4 py-3">
                <SheetTitle>{viewingReady.scan.student.name}</SheetTitle>
                <p className="text-sm font-semibold text-neutral-800">
                  {viewingReady.scan.student.programName}
                  {" · "}
                  Class {viewingReady.scan.student.classLevel}-
                  {viewingReady.scan.student.sectionName?.trim() || "A"}
                </p>
                <p className="text-sm text-neutral-600">
                  {viewingReady.pdfPage != null ? `PDF page ${viewingReady.pdfPage} · ` : ""}
                  Reg {viewingReady.scan.student.rollNo} ·{" "}
                  {formatMarks(viewingReady.scan.total)}/{formatMarks(viewingReady.scan.maxTotal)}
                </p>
              </SheetHeader>
              <div className="min-h-0 flex-1">
                <ReadySheetImage
                  key={viewingReady.previewId}
                  portal={portal}
                  previewId={viewingReady.previewId}
                  marked={viewingReady.scan.sheetImage}
                  label={
                    viewingReady.pdfPage != null
                      ? `PDF page ${viewingReady.pdfPage}`
                      : viewingReady.scan.student.name
                  }
                />
              </div>
              <div className="shrink-0 space-y-3 border-t border-neutral-100 p-4">
                <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                  Edit registration
                </p>
                <OmrRollRecovery
                  portal={portal}
                  message="Edit registration"
                  editMode
                  busy={savingReadyId === viewingReady.previewId || savingAll}
                  schoolId={viewingReady.scan.student.schoolId}
                  inputId={`omr-view-edit-roll-${viewingReady.previewId}`}
                  initialMatches={readyMatches[viewingReady.previewId] ?? NO_MATCHES}
                  initialRollNo={viewingReady.scan.student.rollNo}
                  initialStudentName={viewingReady.scan.student.name}
                  placementHint={{
                    schoolId: viewingReady.scan.student.schoolId,
                    classLevel: viewingReady.scan.student.classLevel,
                    programCode: viewingReady.scan.student.programCode,
                  }}
                  onSaveWithRoll={(roll, schoolId, studentName, sectionId, placement) =>
                    void saveReadyWithRoll(
                      viewingReady,
                      roll,
                      schoolId,
                      studentName,
                      sectionId,
                      placement,
                    )
                  }
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={savingAll}
                    onClick={() => {
                      const index = getScanBatch().findIndex(
                        (item) => item.previewId === viewingReady.previewId,
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
                    disabled={savingAll || downloading === viewingReady.previewId}
                    onClick={() => void handleDownloadReady(viewingReady)}
                  >
                    {downloading === viewingReady.previewId ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    Download
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={savingAll || saving.has(viewingReady.previewId)}
                    onClick={() => onSaveOne(viewingReady)}
                  >
                    {saving.has(viewingReady.previewId) ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Save
                  </Button>
                </div>
              </div>
            </>
          ) : viewingFailed ? (
            <>
              <SheetHeader className="shrink-0 border-b border-neutral-100 px-4 py-3">
                <SheetTitle>PDF page {viewingFailed.page}</SheetTitle>
                <p className="text-sm text-red-700">{displayScanError(viewingFailed.message)}</p>
                {viewingFailed.total != null && viewingFailed.maxTotal != null ? (
                  <p className="text-sm font-semibold tabular-nums text-neutral-800">
                    Score {formatMarks(viewingFailed.total)}/{formatMarks(viewingFailed.maxTotal)}
                  </p>
                ) : null}
              </SheetHeader>
              <div className="min-h-0 flex-1">
                {viewingFailed.previewId ? (
                  <ReadySheetImage
                    key={viewingFailed.previewId}
                    portal={portal}
                    previewId={viewingFailed.previewId}
                    label={`PDF page ${viewingFailed.page}`}
                  />
                ) : (
                  <ImageZoomPane
                    key={viewingFailed.page}
                    className="h-full"
                    toolbarLeft={`PDF page ${viewingFailed.page}`}
                    resetKey={viewingFailed.page}
                  >
                    <FailedPageImage page={viewingFailed.page} portal={portal} />
                  </ImageZoomPane>
                )}
              </div>
              {canRecoverRoll(viewingFailed.message) &&
              (viewingFailed.hasImage || viewingFailed.previewId) ? (
                <div className="shrink-0 space-y-3 border-t border-neutral-100 p-4">
                  <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                    Enter registration
                  </p>
                  <OmrRollRecovery
                    portal={portal}
                    message={viewingFailed.message}
                    busy={savingAll || savingPage === viewingFailed.page}
                    inputId={`omr-recovery-sheet-roll-${viewingFailed.page}`}
                    initialMatches={pageMatches[viewingFailed.page] ?? NO_MATCHES}
                    initialRollNo={
                      pageRollHints[viewingFailed.page] ?? viewingFailed.rollNo?.trim() ?? ""
                    }
                    onSaveWithRoll={(roll, schoolId, studentName, sectionId, placement) =>
                      void saveFailedWithRoll(
                        viewingFailed,
                        roll,
                        schoolId,
                        studentName,
                        sectionId,
                        placement,
                      )
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
          align="start"
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
