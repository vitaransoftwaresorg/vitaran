"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRegisterInPageBack } from "@/components/layout/in-page-back";
import { Button } from "@/components/ui/button";
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
import { ScanCamera } from "./camera";
import { FailedPages } from "./failed-pages";
import { resumePdfJob, stopPdfJob } from "./pdf-batch";
import type { ScanQueueItem } from "./queue-item";
import type { ScanPortal } from "@/services/scans";
import type { ScanPreview } from "@/types/scan";

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
  useRegisterInPageBack(batch.length > 0 || job ? clearReview : null);

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
        toast.success(`Saved ${result.scan.student.name} · ${result.scan.total}/${result.scan.maxTotal}`);
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

  return (
    <div className={showCamera ? "grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]" : "space-y-4"}>
      {showCamera ? (
        <ScanCamera
          key={cameraKey}
          portal={portal}
          onScanned={onScanned}
          onQueued={onQueued}
          scanAction={(form) => previewScanAction(portal, form)}
          testId={testId}
          onTestId={setTestId}
        />
      ) : null}

      <div className="space-y-4">
        {openingSingle ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
            <Loader2 className="size-6 animate-spin text-brand-700" />
            <p className="text-sm font-semibold text-neutral-900">Opening the sheet…</p>
          </div>
        ) : batch.length > 0 || job ? (
          <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <header className="space-y-2 border-b border-neutral-100 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wider text-brand-700 uppercase">
                    PDF batch · {batch.length} sheet{batch.length === 1 ? "" : "s"} to review
                  </p>
                  <p className="text-sm text-neutral-600">
                    {reading
                      ? "Reading in the background — review or save sheets as they appear, or leave this page and come back."
                      : "Open a sheet to check it, save sheets one by one, or save them all."}
                  </p>
                </div>
                {job ? (
                  <button
                    type="button"
                    onClick={clearReview}
                    disabled={savingAll}
                    className="shrink-0 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {reading ? "Stop" : "Close"}
                  </button>
                ) : null}
              </div>
              {job ? (
                <div className="space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-brand-700 transition-[width] duration-500"
                      style={{ width: `${Math.round((job.done / Math.max(1, job.pageCount)) * 100)}%` }}
                    />
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-neutral-500 tabular-nums">
                    {reading ? <Loader2 className="size-3 animate-spin" /> : null}
                    {reading ? `Reading page ${Math.min(job.done + 1, job.pageCount)} of ${job.pageCount}` : `Read ${job.pageCount} pages`}
                    {" · "}Test ID {job.testId}
                    {job.duplicates ? ` · ${job.duplicates} duplicate${job.duplicates === 1 ? "" : "s"} skipped` : ""}
                    {job.failures.length ? ` · ${job.failures.length} failed` : ""}
                  </p>
                  {job.failures.length ? (
                    <FailedPages portal={portal} testId={job.testId} failures={job.failures} disabled={savingAll} />
                  ) : null}
                </div>
              ) : null}
            </header>
            {batch.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">
                {reading
                  ? "Sheets appear here as soon as they are read."
                  : job?.failures.length
                    ? "Every sheet that was read is saved. Scan the failed pages again above, or close."
                    : "Every sheet from this PDF is saved."}
              </p>
            ) : null}
            {savingAll ? (
              <div className="space-y-2 border-b border-brand-100 bg-brand-50/60 px-4 py-4" role="status" aria-live="polite">
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
            {batch.length > 0 ? (
              <div className="flex items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50/60 px-4 py-2">
                <p className="text-xs text-neutral-500">
                  {savingAll
                    ? `Saving ${saveProgress.done} of ${saveProgress.total}…`
                    : `${batch.length} sheet${batch.length === 1 ? "" : "s"} ready to save`}
                </p>
                <Button type="button" size="sm" onClick={() => void saveAll()} disabled={savingAll || saving.size > 0}>
                  {savingAll ? <Loader2 className="animate-spin" /> : null}
                  Save all ({batch.length})
                </Button>
              </div>
            ) : null}
            <ul className="max-h-[36rem] divide-y divide-neutral-100 overflow-y-auto">
              {batch.map((item, index) => {
                const row = item.scan;
                const busy = savingAll || saving.has(item.previewId);
                return (
                  <li key={item.previewId} className="flex items-center gap-2 pr-3 transition-colors hover:bg-neutral-50">
                    <button
                      type="button"
                      onClick={() => openReview(index)}
                      disabled={savingAll}
                      className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left disabled:cursor-wait"
                    >
                      {row.sheetImage ? (
                        <img
                          src={row.sheetImage}
                          alt=""
                          className="h-14 w-10 shrink-0 rounded border border-neutral-200 object-cover bg-neutral-50"
                        />
                      ) : (
                        <div className="h-14 w-10 shrink-0 rounded border border-dashed border-neutral-200 bg-neutral-50" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-950">{row.student.name}</p>
                        <p className="truncate text-xs text-neutral-500">
                          #{index + 1} · Reg {row.student.rollNo} · Class {row.student.classLevel}-
                          {row.student.sectionName?.trim() || "A"} · Test No {row.testNumber}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-brand-900">
                        {row.total}/{row.maxTotal}
                      </p>
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openReview(index)}
                      disabled={savingAll}
                      aria-label={`View ${row.student.name}`}
                    >
                      View
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void saveOne(item)}
                      aria-label={`Save ${row.student.name}`}
                    >
                      {saving.has(item.previewId) ? <Loader2 className="animate-spin" /> : null}
                      Save
                    </Button>
                  </li>
                );
              })}
            </ul>
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
