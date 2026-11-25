"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { commitScanAction, commitScansAction, previewScanAction } from "./actions";
import {
  clearScanBatch,
  getPdfJob,
  getScanBatch,
  removeScanBatchById,
  setScanBatch,
  subscribeScanBatch,
} from "./batch-store";
import { usePublicSettings } from "@/features/settings/use-public-settings";
import { ScanCamera } from "./camera";
import { resumePdfJob, stopPdfJob } from "./pdf-batch";
import type { ScanQueueItem } from "./queue-item";
import { ScanSheetTable } from "./scan-sheet-table";
import { useIsPhone } from "./use-is-phone";
import type { ScanPortal } from "@/services/scans";
import { formatMarks, type ScanPreview } from "@/types/scan";

const BASE: Record<ScanPortal, string> = {
  admin: "/admin/omr-scan",
  school: "/school/omr-scan",
  teacher: "/teacher/omr-scan",
};

/** Sheets per "Save all" request (backend limit 25), so progress moves and no request runs too long. */
const SAVE_CHUNK = 25;

export function ScanBoard({ portal }: { portal: ScanPortal }) {
  const router = useRouter();
  const base = BASE[portal];
  const phone = useIsPhone();
  const { settings, ready: settingsReady } = usePublicSettings();
  const omrAllowed =
    portal === "admin"
      ? true
      : phone === null
        ? true
        : portal === "teacher"
          ? phone
            ? settings.teacherMobileOmrEnabled
            : settings.teacherDesktopOmrEnabled
          : phone
            ? settings.schoolMobileOmrEnabled
            : settings.schoolDesktopOmrEnabled;
  const [batch, setBatch] = useState<ScanPreview[]>(() => {
    // A single photo has no list: coming back from its review starts a new scan.
    if (getScanBatch().length === 1 && !getPdfJob()) clearScanBatch();
    return getScanBatch();
  });
  const [job, setJob] = useState(() => getPdfJob());
  const [saving, setSaving] = useState<Set<string>>(() => new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });
  const [queued, setQueued] = useState(0);
  const [cameraKey, setCameraKey] = useState(0);
  // Owned by this page, so opening it any way (back from review, refresh, menu) starts with an empty test ID.
  const [testId, setTestId] = useState("");
  const [examPattern, setExamPattern] = useState<"" | "MPCB" | "PCB" | "MPC">("");
  const restRef = useRef<ScanQueueItem[]>([]);

  useEffect(
    () =>
      subscribeScanBatch(() => {
        setBatch(getScanBatch());
        setJob(getPdfJob());
      }),
    [],
  );
  useEffect(() => router.prefetch(`${base}/review`), [router, base]);
  useEffect(() => {
    void resumePdfJob(portal);
  }, [portal]);

  useEffect(() => {
    if (!savingAll) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [savingAll]);

  // Every sheet of a finished PDF has been saved and no failed page is left: back to the upload screen.
  const failedCount = job?.failures.length ?? 0;
  useEffect(() => {
    if (job?.finished && batch.length === 0 && failedCount === 0) void stopPdfJob();
  }, [job?.finished, batch.length, failedCount]);

  const clearReview = useCallback(() => {
    void stopPdfJob();
    clearScanBatch();
    setQueued(0);
    setCameraKey((key) => key + 1);
    restRef.current = [];
  }, []);

  function openReview(index: number) {
    // Next keeps this page's state for back navigation, so empty the field before leaving for review.
    setTestId("");
    router.push(`${base}/review?i=${index}`);
  }

  function onScanned(result: ScanPreview) {
    setScanBatch([result]);
    openReview(0);
  }

  async function commit(item: ScanPreview) {
    const result = await commitScanAction(portal, item.previewId);
    if (result.ok) removeScanBatchById(item.previewId);
    return result;
  }

  async function saveOne(item: ScanPreview) {
    setSaving((current) => new Set(current).add(item.previewId));
    try {
      const result = await commit(item);
      if (result.ok) {
        toast.success(
          `Saved ${result.scan.student.name} · ${formatMarks(result.scan.total)}/${formatMarks(result.scan.maxTotal)}`,
        );
        router.refresh();
      } else toast.error(`${item.scan.student.name}: ${result.message}`);
    } finally {
      setSaving((current) => {
        const next = new Set(current);
        next.delete(item.previewId);
        return next;
      });
    }
  }

  /** Saves the sheets listed now; sheets still being read are added to the list after. */
  async function saveAll() {
    const items = getScanBatch();
    if (!items.length) return;
    setSavingAll(true);
    setSaveProgress({ done: 0, total: items.length });
    const failures: string[] = [];
    const label = (item: ScanPreview) => `${item.scan.student.name} (Reg ${item.scan.student.rollNo})`;
    let saved = 0;
    let done = 0;
    try {
      for (let start = 0; start < items.length; start += SAVE_CHUNK) {
        const chunk = items.slice(start, start + SAVE_CHUNK);
        try {
          const response = await commitScansAction(portal, chunk.map((item) => item.previewId));
          if (!response.ok) throw new Error(response.message);
          const byId = new Map(chunk.map((item) => [item.previewId, item]));
          for (const result of response.results) {
            const item = byId.get(result.previewId);
            if (result.ok) {
              saved += 1;
              removeScanBatchById(result.previewId);
            } else if (item) failures.push(`${label(item)}: ${result.message}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not save";
          failures.push(...chunk.map((item) => `${label(item)}: ${message}`));
        }
        done += chunk.length;
        setSaveProgress({ done, total: items.length });
      }
    } finally {
      setSavingAll(false);
      router.refresh();
    }
    if (failures.length) {
      toast.warning(`Saved ${saved} of ${items.length} sheets`, {
        description: failures.slice(0, 6).join("\n") + (failures.length > 6 ? `\n+${failures.length - 6} more` : ""),
        duration: 15000,
        classNames: { description: "whitespace-pre-line" },
      });
    } else toast.success(`Saved all ${saved} sheet${saved === 1 ? "" : "s"}`);
  }

  function onQueued(items: ScanQueueItem[]) {
    restRef.current = items;
    setQueued(items.length);
  }

  async function drainPhotoQueue() {
    while (restRef.current.length) {
      const next = restRef.current.shift();
      setQueued(restRef.current.length);
      if (!next || next.kind !== "file") break;
      try {
        const form = new FormData();
        form.append("file", next.file);
        if (next.testId) form.append("testId", next.testId);
        if (next.examPattern) form.append("examPattern", next.examPattern);
        const result = await previewScanAction(portal, form);
        if (result.ok) {
          setScanBatch([result.result]);
          openReview(0);
          return;
        }
        toast.error(result.message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not read this sheet.");
      }
    }
    clearReview();
  }

  // When returning from a single-photo review with more files queued, continue.
  useEffect(() => {
    if (batch.length || !restRef.current.length) return;
    void drainPhotoQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when batch empties after save
  }, [batch.length]);

  const showCamera = batch.length === 0 && !job;
  // One photo goes straight to its review page; the list is only for PDF batches.
  const openingSingle = batch.length === 1 && !job;
  const reading = job != null && !job.finished;

  if (settingsReady && !omrAllowed) {
    const isTeacher = portal === "teacher";
    const onPhone = Boolean(phone);
    const title = onPhone
      ? isTeacher
        ? "Teacher mobile scan is off"
        : "School mobile scan is off"
      : isTeacher
        ? "Teacher desktop OMR is off"
        : "School desktop OMR is off";
    const otherStillOn = onPhone
      ? isTeacher
        ? settings.teacherDesktopOmrEnabled
        : settings.schoolDesktopOmrEnabled
      : isTeacher
        ? settings.teacherMobileOmrEnabled
        : settings.schoolMobileOmrEnabled;
    const detail = onPhone
      ? otherStillOn
        ? "Phone camera scan is disabled for now. Desktop OMR on a computer is still available."
        : "Phone camera scan is disabled for now. Ask an admin to turn it on under Settings → OMR scan access."
      : otherStillOn
        ? "Desktop PDF / photo upload is disabled for now. Mobile scan on a phone is still available."
        : "Desktop PDF / photo upload is disabled for now. Ask an admin to turn it on under Settings → OMR scan access.";
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center shadow-sm">
        <span className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <ScanLine className="size-6" strokeWidth={2} />
        </span>
        <p className="mt-4 text-lg font-bold text-amber-950">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-amber-900/85">{detail}</p>
        <p className="mt-4 text-xs font-medium text-amber-800/70">
          Admin → Settings → OMR scan access
        </p>
      </div>
    );
  }

  const previewOpen = batch.length > 0 || job != null;

  return (
    <div
      className={
        showCamera
          ? "grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
          : previewOpen
            ? "flex h-[calc(100dvh-7.25rem)] min-h-0 flex-col"
            : "space-y-4"
      }
    >
      {showCamera ? (
        <ScanCamera
          key={cameraKey}
          portal={portal}
          onScanned={onScanned}
          onQueued={onQueued}
          scanAction={(form) => previewScanAction(portal, form)}
          testId={testId}
          onTestId={setTestId}
          examPattern={examPattern}
          onExamPattern={setExamPattern}
        />
      ) : null}

      <div className={previewOpen && !showCamera ? "flex min-h-0 flex-1 flex-col" : "space-y-4"}>
        {openingSingle ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
            <Loader2 className="size-6 animate-spin text-brand-700" />
            <p className="text-sm font-semibold text-neutral-900">Opening the sheet…</p>
          </div>
        ) : batch.length > 0 || job ? (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <header className="shrink-0 space-y-3 border-b border-neutral-100 px-5 py-4">
              {job ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={clearReview}
                          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-900 hover:opacity-70 active:opacity-60"
                        >
                          <ArrowLeft className="size-4" strokeWidth={2.25} />
                          Back
                        </button>
                        <p className="text-base font-bold tabular-nums text-neutral-950">
                          Test ID {job.testId}
                          {job.examPattern ? (
                            <span className="font-semibold text-neutral-500"> · {job.examPattern}</span>
                          ) : null}
                        </p>
                      </div>
                      {(job.keys?.length
                        ? job.keys
                        : batch[0]
                          ? [
                              {
                                programName: batch[0].scan.student.programName,
                                classLevel: batch[0].scan.student.classLevel,
                                testNumber: batch[0].scan.testNumber,
                                sectionName: batch[0].scan.student.sectionName,
                              },
                            ]
                          : []
                      ).map((key, index) => (
                        <p
                          key={`${key.programName}-${key.classLevel}-${key.testNumber}-${index}`}
                          className="text-sm font-semibold text-neutral-800"
                        >
                          {key.programName}
                          {" · "}
                          Class {key.classLevel}
                          {key.sectionName?.trim() ? `-${key.sectionName.trim()}` : ""}
                          {" · "}
                          Test No {key.testNumber}
                        </p>
                      ))}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-sm tabular-nums">
                      {reading ? (
                        <p className="flex items-center gap-1.5 text-neutral-500">
                          <Loader2 className="size-3.5 animate-spin" />
                          Reading page {Math.min(job.done + 1, job.pageCount)} of {job.pageCount}
                        </p>
                      ) : (
                        <>
                          <span className="font-semibold text-emerald-800">
                            {Math.max(0, job.pageCount - job.failures.length)} ready
                          </span>
                          {job.failures.length > 0 ? (
                            <span className="font-semibold text-red-700">
                              {job.failures.length} failed
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-brand-700 transition-[width] duration-500"
                      style={{ width: `${Math.round((job.done / Math.max(1, job.pageCount)) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : batch[0] ? (
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={clearReview}
                      className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-900 hover:opacity-70 active:opacity-60"
                    >
                      <ArrowLeft className="size-4" strokeWidth={2.25} />
                      Back
                    </button>
                    <p className="text-base font-bold tabular-nums text-neutral-950">
                      Test ID {batch[0].scan.testId}
                      {examPattern ? (
                        <span className="font-semibold text-neutral-500"> · {examPattern}</span>
                      ) : null}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-neutral-800">
                    {batch[0].scan.student.programName}
                    {" · "}
                    Class {batch[0].scan.student.classLevel}
                    {batch[0].scan.student.sectionName?.trim()
                      ? `-${batch[0].scan.student.sectionName.trim()}`
                      : ""}
                    {" · "}
                    Test No {batch[0].scan.testNumber}
                  </p>
                </div>
              ) : null}
            </header>
            {savingAll ? (
              <div className="shrink-0 space-y-2 border-b border-brand-100 bg-brand-50/60 px-4 py-4" role="status" aria-live="polite">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="size-5 shrink-0 animate-spin text-brand-700" />
                  <p className="text-sm font-semibold text-neutral-900 tabular-nums">
                    Saving {saveProgress.done} of {saveProgress.total} sheets…
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-brand-700 transition-[width] duration-300"
                    style={{ width: `${Math.round((saveProgress.done / Math.max(1, saveProgress.total)) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-500">Keep this page open until saving finishes.</p>
              </div>
            ) : null}
            {batch.length > 0 || (job?.failures.length ?? 0) > 0 ? (
              <ScanSheetTable
                portal={portal}
                testId={job?.testId ?? batch[0]?.scan.testId ?? testId}
                examPattern={job?.examPattern ?? examPattern}
                batch={batch}
                failures={job?.failures ?? []}
                saving={saving}
                savingAll={savingAll}
                onSaveOne={(item) => void saveOne(item)}
                onSaveAll={() => void saveAll()}
                onOpenReview={openReview}
              />
            ) : null}
          </section>
        ) : (
          <p
            className={cn(
              "rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500",
              queued === 0 && "hidden sm:block",
            )}
          >
            <span className="hidden sm:inline">
              Enter the test ID, then upload a PDF (one student sheet per page). Open each sheet on its own
              page to review and save.
              {queued > 0 ? " · " : ""}
            </span>
            {queued > 0 ? `${queued} photo${queued === 1 ? "" : "s"} waiting` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
