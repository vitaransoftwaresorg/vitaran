"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ScanPortal } from "@/services/scans";
import { previewScanAction } from "./actions";
import { getScanBatch, setScanBatch, type PdfFailure } from "./batch-store";
import { asJpegFile } from "./camera";
import { OmrRollRecovery } from "./omr-roll-recovery";
import type { OmrStudentMatch } from "./omr-student-actions";
import { fetchFailedPageImage, resolvePdfFailure } from "./pdf-batch";
import { canRecoverRoll, isDuplicateRollError, ROLL_LENGTH, rollInput } from "./roll-helpers";

const NO_MATCHES: OmrStudentMatch[] = [];

/** Each failed / duplicate PDF page gets its own enter-reg + save row. */
export function FailedPages({
  portal,
  testId,
  examPattern,
  failures,
  disabled,
}: {
  portal: ScanPortal;
  testId: string;
  examPattern: string;
  failures: PdfFailure[];
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<number | null>(null);
  const [rescanning, setRescanning] = useState<number | null>(null);
  const [viewing, setViewing] = useState<PdfFailure | null>(null);
  const [savingPage, setSavingPage] = useState<number | null>(null);
  const [pageMatches, setPageMatches] = useState<Record<number, OmrStudentMatch[]>>({});
  const [pageRollHints, setPageRollHints] = useState<Record<number, string>>({});

  const sorted = [...failures].sort((a, b) => a.page - b.page);
  const duplicateCount = sorted.filter((f) => isDuplicateRollError(f.message)).length;

  function pickPhoto(page: number) {
    targetRef.current = page;
    inputRef.current?.click();
  }

  async function rescan(file: File) {
    const page = targetRef.current;
    if (page == null) return;
    setRescanning(page);
    try {
      const form = new FormData();
      form.append("file", await asJpegFile(file));
      form.append("testId", testId);
      form.append("examPattern", examPattern);
      const result = await previewScanAction(portal, form);
      if (!result.ok) {
        toast.error(`Page ${page}: ${result.message}`);
        if (result.matches?.length) {
          setPageMatches((prev) => ({ ...prev, [page]: result.matches ?? [] }));
          setPageRollHints((prev) => ({
            ...prev,
            [page]: result.rollNo ?? "",
          }));
        }
        return;
      }
      const reg = result.result.scan.student.rollNo;
      if (getScanBatch().some((item) => item.scan.student.rollNo === reg)) {
        toast.warning(
          `Page ${page}: Reg ${reg} is already in the review list. Enter a different registration for this sheet.`,
        );
        return;
      }
      setScanBatch([...getScanBatch(), result.result]);
      resolvePdfFailure(page);
      setViewing((current) => (current?.page === page ? null : current));
      toast.success(`Page ${page} read · ${result.result.scan.student.name} added to the list`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read this sheet.");
    } finally {
      setRescanning(null);
    }
  }

  async function saveWithRoll(failure: PdfFailure, typedRoll: string, schoolId?: string) {
    if (!failure.hasImage) {
      toast.error("No page image to save — scan this sheet again.");
      return;
    }
    const typed = rollInput(typedRoll);
    if (typed.length !== ROLL_LENGTH) {
      toast.error("Enter the 7-digit registration number, then save.");
      return;
    }
    setSavingPage(failure.page);
    try {
      const url = await fetchFailedPageImage(failure.page);
      const blob = await fetch(url).then((response) => response.blob());
      URL.revokeObjectURL(url);
      const form = new FormData();
      form.append("file", await asJpegFile(blob));
      form.append("testId", testId);
      form.append("examPattern", examPattern);
      form.append("rollNo", typed);
      if (schoolId) form.append("schoolId", schoolId);
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
          `Page ${failure.page}: Reg ${reg} is already in the review list. Enter a different registration for this sheet.`,
        );
        return;
      }
      setScanBatch([...getScanBatch(), result.result]);
      resolvePdfFailure(failure.page);
      setPageMatches((prev) => {
        const next = { ...prev };
        delete next[failure.page];
        return next;
      });
      setViewing((current) => (current?.page === failure.page ? null : current));
      toast.success(`Page ${failure.page} saved · ${result.result.scan.student.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this page.");
    } finally {
      setSavingPage(null);
    }
  }

  return (
    <details className="text-xs text-red-700" open>
      <summary className="cursor-pointer font-medium">
        {duplicateCount
          ? `${duplicateCount} duplicate sheet${duplicateCount === 1 ? "" : "s"} — enter the correct registration for each`
          : `Pages that need attention (${sorted.length}) — please enter the correct registration number`}
        {sorted.length > duplicateCount
          ? ` · ${sorted.length - duplicateCount} other`
          : ""}
      </summary>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void rescan(file);
        }}
      />
      <ul className="mt-2 max-h-[28rem] space-y-3 overflow-y-auto pr-0.5">
        {sorted.map((failure, index) => {
          const recoverRoll = canRecoverRoll(failure.message);
          const isDup = isDuplicateRollError(failure.message);
          const busy = rescanning === failure.page || savingPage === failure.page;
          // After a failed save/lookup, keep the typed hint; don't seed the colliding duplicate roll.
          const hintRoll = pageRollHints[failure.page] ?? "";
          return (
            <li
              key={failure.page}
              className="rounded-xl border border-red-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-semibold text-neutral-900">
                    Sheet {index + 1} of {sorted.length}
                    <span className="font-normal text-neutral-500"> · PDF page {failure.page}</span>
                    {isDup && failure.rollNo ? (
                      <span className="font-normal text-amber-800"> · read as {failure.rollNo}</span>
                    ) : null}
                  </p>
                  <p className={isDup ? "text-amber-800" : "text-red-600"}>{failure.message}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {failure.hasImage ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => setViewing(failure)}
                    >
                      <Eye className="size-3.5" />
                      View
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={disabled || busy}
                    onClick={() => pickPhoto(failure.page)}
                  >
                    {rescanning === failure.page ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Camera className="size-3.5" />
                    )}
                    {rescanning === failure.page ? "Reading…" : "Scan again"}
                  </Button>
                </div>
              </div>
              {recoverRoll && failure.hasImage ? (
                <div className="mt-2 border-t border-red-100 pt-2">
                  <OmrRollRecovery
                    portal={portal}
                    message={failure.message}
                    busy={disabled || busy}
                    inputId={`omr-recovery-roll-${failure.page}`}
                    initialMatches={pageMatches[failure.page] ?? NO_MATCHES}
                    initialRollNo={hintRoll}
                    onSaveWithRoll={(roll, schoolId) => void saveWithRoll(failure, roll, schoolId)}
                  />
                </div>
              ) : recoverRoll && !failure.hasImage ? (
                <p className="mt-2 text-[11px] text-amber-800">
                  No saved page image — use Scan again, then enter the registration number.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Sheet open={viewing != null} onOpenChange={(open) => (open ? null : setViewing(null))}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Page {viewing?.page}</SheetTitle>
            <p className="text-sm text-red-700">{viewing?.message}</p>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {viewing ? <PageImage key={viewing.page} page={viewing.page} /> : null}
          </div>
          {viewing ? (
            <div className="space-y-3 border-t border-neutral-100 p-4">
              {canRecoverRoll(viewing.message) && viewing.hasImage ? (
                <OmrRollRecovery
                  portal={portal}
                  message={viewing.message}
                  busy={disabled || savingPage === viewing.page || rescanning != null}
                  inputId={`omr-recovery-sheet-roll-${viewing.page}`}
                  initialMatches={pageMatches[viewing.page] ?? NO_MATCHES}
                  initialRollNo={pageRollHints[viewing.page] ?? ""}
                  onSaveWithRoll={(roll, schoolId) => void saveWithRoll(viewing, roll, schoolId)}
                />
              ) : null}
              <Button
                type="button"
                className="w-full gap-1.5"
                disabled={disabled || rescanning != null}
                onClick={() => pickPhoto(viewing.page)}
              >
                {rescanning === viewing.page ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                {rescanning === viewing.page ? "Reading…" : "Scan this sheet again"}
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </details>
  );
}

function PageImage({ page }: { page: number }) {
  const [state, setState] = useState<{ url?: string; error?: string }>({});

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    fetchFailedPageImage(page)
      .then((next) => {
        url = next;
        if (cancelled) URL.revokeObjectURL(next);
        else setState({ url: next });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ error: error instanceof Error ? error.message : "Could not load this page." });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [page]);

  if (state.error) return <p className="py-10 text-center text-sm text-red-700">{state.error}</p>;
  if (!state.url) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-brand-700" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- blob URL from the scan API
  return <img src={state.url} alt={`PDF page ${page}`} className="w-full rounded-lg border border-neutral-200" />;
}
