"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLiveContent } from "@/features/live/use-live-content";
import type { ScanPortal } from "@/services/scans";
import { formatMarks, type OmScan } from "@/types/scan";
import { listRecentScansAction } from "./actions";

type RecentSavedScansProps = {
  portal: ScanPortal;
  /** Admin live stream path. */
  livePath?: string;
};

/**
 * Saved OMRs for this school/teacher/admin, refreshed when another device saves a scan.
 */
export function RecentSavedScans({ portal, livePath }: RecentSavedScansProps) {
  const [scans, setScans] = useState<OmScan[]>([]);
  const [pending, setPending] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());
  const ready = useRef(false);

  const reload = useCallback(() => {
    void (async () => {
      setPending(true);
      try {
        const next = await listRecentScansAction(portal);
        if (ready.current) {
          const fresh = next.filter((scan) => !knownIds.current.has(scan.id));
          for (const scan of fresh.slice(0, 3)) {
            toast.message(
              `Saved on another device · ${scan.student.name} · ${formatMarks(scan.total)}/${formatMarks(scan.maxTotal)}`,
            );
          }
        }
        knownIds.current = new Set(next.map((scan) => scan.id));
        ready.current = true;
        setScans(next);
      } finally {
        setPending(false);
      }
    })();
  }, [portal]);

  useLiveContent("results", reload, livePath);

  useEffect(() => {
    reload();
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  if (scans.length === 0 && !pending) {
    return (
      <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-5 text-sm text-neutral-500">
        Saved scans from this account appear here on every device — open Results to view marks and OMR.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_24px_-16px_rgb(25_28_95/0.35)]">
      <header className="flex items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/70 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-bold text-neutral-950">Recently saved</h2>
          <p className="text-xs text-neutral-500">Live across all devices signed in with this account</p>
        </div>
        {pending ? <span className="text-[11px] font-medium text-neutral-400">Updating…</span> : null}
      </header>
      <ul className="max-h-72 divide-y divide-neutral-100 overflow-y-auto">
        {scans.map((scan) => (
          <li key={scan.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-950">{scan.student.name}</p>
              <p className="truncate text-xs text-neutral-500">
                Reg {scan.student.rollNo} · Class {scan.student.classLevel}
                {scan.student.sectionName ? `-${scan.student.sectionName}` : ""} · Test {scan.testNumber}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold tabular-nums text-brand-900">
              {formatMarks(scan.total)}/{formatMarks(scan.maxTotal)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
