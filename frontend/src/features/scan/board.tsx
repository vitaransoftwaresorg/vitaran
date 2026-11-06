"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { previewScanAction } from "./actions";
import {
  clearScanBatch,
  getLastTestId,
  getScanBatch,
  setLastTestId,
  setScanBatch,
  subscribeScanBatch,
} from "./batch-store";
import { ScanCamera } from "./camera";
import type { ScanQueueItem } from "./queue-item";
import type { ScanPortal } from "@/services/scans";
import type { ScanPreview } from "@/types/scan";

const BASE: Record<ScanPortal, string> = {
  admin: "/admin/omr-scan",
  school: "/school/omr-scan",
  teacher: "/teacher/omr-scan",
};

export function ScanBoard({ portal }: { portal: ScanPortal }) {
  const router = useRouter();
  const base = BASE[portal];
  const [batch, setBatch] = useState<ScanPreview[]>(() => getScanBatch());
  const [queued, setQueued] = useState(0);
  const [cameraKey, setCameraKey] = useState(0);
  const [rollNo, setRollNo] = useState("");
  const [testId, setTestIdState] = useState(() => getLastTestId());
  function setTestId(value: string) {
    setLastTestId(value);
    setTestIdState(value);
  }
  const restRef = useRef<ScanQueueItem[]>([]);

  useEffect(() => subscribeScanBatch(() => setBatch(getScanBatch())), []);

  function clearReview() {
    clearScanBatch();
    setQueued(0);
    setCameraKey((key) => key + 1);
    restRef.current = [];
  }

  function openReview(index: number) {
    router.push(`${base}/review?i=${index}`);
  }

  function onScanned(result: ScanPreview) {
    setScanBatch([result]);
    openReview(0);
  }

  function onBatchScanned(results: ScanPreview[]) {
    setScanBatch(results);
    restRef.current = [];
    setQueued(0);
    if (results.length === 1) openReview(0);
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

  const showCamera = batch.length === 0;

  return (
    <div className={showCamera ? "grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]" : "space-y-4"}>
      {showCamera ? (
        <ScanCamera
          key={cameraKey}
          portal={portal}
          onScanned={onScanned}
          onBatchScanned={onBatchScanned}
          onQueued={onQueued}
          scanAction={(form) => previewScanAction(portal, form)}
          rollNo={rollNo}
          testId={testId}
          onRollNo={setRollNo}
          onTestId={setTestId}
        />
      ) : null}

      <div className="space-y-4">
        {batch.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <header className="border-b border-neutral-100 px-4 py-3">
              <p className="text-xs font-semibold tracking-wider text-brand-700 uppercase">
                PDF batch · {batch.length} sheet{batch.length === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-neutral-600">Open a sheet to review and save it on its own page.</p>
            </header>
            <ul className="max-h-[36rem] divide-y divide-neutral-100 overflow-y-auto">
              {batch.map((item, index) => {
                const row = item.scan;
                return (
                  <li key={item.previewId}>
                    <button
                      type="button"
                      onClick={() => openReview(index)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50"
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
                          {row.student.sectionName?.trim() || "A"}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-brand-900">
                        {row.total}/{row.maxTotal}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-neutral-100 px-4 py-3">
              <Button type="button" variant="outline" onClick={clearReview}>
                Back to upload
              </Button>
            </div>
          </section>
        ) : (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
            Enter the test ID, then upload a PDF (one student sheet per page). Open each sheet on its own
            page to review and save.
            {queued > 0 ? ` · ${queued} photo${queued === 1 ? "" : "s"} waiting` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
