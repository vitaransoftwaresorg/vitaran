"use client";

import { toast } from "sonner";
import type { ScanPortal } from "@/services/scans";
import type { PdfBatchSummary } from "@/types/scan";
import {
  getPdfJob,
  getScanBatch,
  setPdfJob,
  setScanBatch,
  type PdfFailure,
  type PdfJob,
  type PdfJobKeyInfo,
} from "./batch-store";
import {
  dismissPdfBatchDirect,
  fetchActivePdfBatchDirect,
  fetchPdfBatchDirect,
  fetchPdfPageImageDirect,
} from "./client-upload";
import { getOmrUploadAuthAction } from "./upload-auth";

const POLL_MS = 2000;
/** Network blips are retried; 500-page jobs run a long time so allow more transient failures. */
const MAX_POLL_ERRORS = 30;

type Auth = { token: string; batchesUrl: string };

let auth: Auth | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let errors = 0;
let resumedFinished = false;

async function getAuth(portal: ScanPortal) {
  const result = await getOmrUploadAuthAction(portal);
  if (!result.ok) throw new Error(result.message);
  auth = { token: result.token, batchesUrl: result.batchesUrl };
  return auth;
}

function schedule(delay: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void poll(), delay);
}

function onFinished() {
  const job = getPdfJob();
  if (!job) return;
  if (!getScanBatch().length && !job.failures.length) {
    // Every sheet was saved already; a PDF picked up again after a reload has nothing left to say.
    if (!resumedFinished) toast.success(`${job.pageCount} ready`);
    void stopPdfJob();
    return;
  }
  if (resumedFinished) return;
  const ready = Math.max(0, job.pageCount - job.failures.length);
  const failed = job.failures.length;
  if (failed) {
    toast.error(`${ready} ready · ${failed} failed`);
  } else {
    toast.success(`${ready} ready — tap Save (${ready})`);
  }
}

/** A failed page was scanned again and read: it leaves the failed list. */
export function resolvePdfFailure(page: number) {
  const job = getPdfJob();
  if (!job) return;
  setPdfJob({ ...job, failures: job.failures.filter((failure) => failure.page !== page) });
}

/** Object URL of a failed PDF page, as rendered on the server. */
export async function fetchFailedPageImage(page: number, portal: ScanPortal) {
  const job = getPdfJob();
  if (!job) throw new Error("This PDF is no longer open. Upload the PDF again.");
  // Always refresh auth for this portal — module auth is lost on remount / HMR.
  const load = async () => {
    const session = await getAuth(portal);
    return fetchPdfPageImageDirect(session.batchesUrl, session.token, job.batchId, page);
  };
  try {
    return await load();
  } catch (error) {
    // Stale token or owner mismatch after login switch — one retry with a fresh session.
    auth = null;
    try {
      return await load();
    } catch {
      throw error instanceof Error
        ? error
        : new Error("Could not load this page. Upload the PDF again.");
    }
  }
}

function failureFromItem(item: {
  page: number;
  error?: string;
  hasImage?: boolean;
  rollNo?: string;
  preview?: { previewId: string; scan: { total: number; maxTotal: number } };
}): PdfFailure | null {
  if (!item.error) return null;
  return {
    page: item.page,
    message: item.error,
    hasImage: Boolean(item.hasImage || item.preview),
    rollNo: item.rollNo?.trim() || undefined,
    previewId: item.preview?.previewId,
    total: item.preview?.scan.total,
    maxTotal: item.preview?.scan.maxTotal,
  };
}

async function poll() {
  timer = null;
  const job = getPdfJob();
  if (!job || job.finished || !auth) return;
  try {
    const status = await fetchPdfBatchDirect(auth.batchesUrl, auth.token, job.batchId, job.next);
    errors = 0;
    if (getPdfJob()?.batchId !== job.batchId) return;

    // Same registration on 2+ sheets → none stay in review; every copy is an enter-reg card.
    const demotions = status.demotions ?? [];
    const collideRolls = new Set(
      [...demotions, ...status.items]
        .filter((item) => Boolean(item.demoted || item.duplicateOf != null))
        .map((item) => item.rollNo?.trim())
        .filter((roll): roll is string => Boolean(roll)),
    );
    if (collideRolls.size) {
      setScanBatch(
        getScanBatch().filter((preview) => !collideRolls.has(preview.scan.student.rollNo.trim())),
      );
    }

    // Error items may still carry a scored preview (needs identity) — keep those as failures only.
    const previews = status.items.flatMap((item) =>
      item.preview && !item.error ? [{ ...item.preview, pdfPage: item.page }] : [],
    );
    if (previews.length) {
      setScanBatch([
        ...getScanBatch().filter((preview) => !collideRolls.has(preview.scan.student.rollNo.trim())),
        ...previews.filter((preview) => !collideRolls.has(preview.scan.student.rollNo.trim())),
      ]);
    }

    const next = job.next + status.items.length;
    const incomingFailures = [...demotions, ...status.items]
      .map(failureFromItem)
      .filter((row): row is PdfFailure => row != null);
    const byPage = new Map(job.failures.map((row) => [row.page, row]));
    for (const row of incomingFailures) {
      // Prefer the latest message (e.g. “appears on 2 sheets” → “appears on 3 sheets”).
      byPage.set(row.page, row);
    }
    // Keep same-registration duplicates consecutive (by roll, then page) — not mixed.
    const mergedFailures = [...byPage.values()].sort((a, b) => {
      const aDup =
        /duplicate registration number/i.test(a.message) ||
        /same registration number as page/i.test(a.message);
      const bDup =
        /duplicate registration number/i.test(b.message) ||
        /same registration number as page/i.test(b.message);
      if (aDup !== bDup) return aDup ? -1 : 1;
      if (aDup && bDup) {
        const aRoll = a.rollNo?.trim() || "";
        const bRoll = b.rollNo?.trim() || "";
        if (aRoll && bRoll && aRoll !== bRoll) return aRoll.localeCompare(bRoll);
      }
      return a.page - b.page;
    });
    const duplicatePages = mergedFailures.filter(
      (row) =>
        /duplicate registration number/i.test(row.message) ||
        /same registration number as page/i.test(row.message),
    ).length;

    setPdfJob({
      ...job,
      done: status.done,
      finished: status.finished && next >= status.done,
      next,
      read: job.read + previews.length,
      failures: mergedFailures,
      duplicates: duplicatePages,
    });
    if (getPdfJob()?.finished) {
      onFinished();
      return;
    }
  } catch (error) {
    errors += 1;
    const message = error instanceof Error ? error.message : "";
    if (/expired/i.test(message) || errors >= MAX_POLL_ERRORS) {
      toast.error(message || "Lost contact with the PDF reader. Upload the PDF again.");
      setPdfJob(null);
      return;
    }
  }
  schedule(POLL_MS);
}

function begin(portal: ScanPortal, summary: PdfBatchSummary, keys: PdfJobKeyInfo[] = []) {
  setPdfJob({
    batchId: summary.batchId,
    fileName: summary.fileName,
    testId: summary.testId,
    examPattern: summary.examPattern ?? "MPCB",
    portal,
    keys,
    pageCount: summary.pageCount,
    done: summary.done,
    finished: false,
    next: 0,
    read: 0,
    failures: [],
    duplicates: 0,
  });
  errors = 0;
  schedule(0);
}

/** Right after upload: the server is already reading; pull sheets in as they finish. */
export async function startPdfJob(
  portal: ScanPortal,
  summary: PdfBatchSummary,
  keys: PdfJobKeyInfo[] = [],
) {
  await getAuth(portal);
  resumedFinished = false;
  begin(portal, summary, keys);
}

/** Back on the scan page after a reload or another tab: carry on with the PDF still on the server. */
export async function resumePdfJob(portal: ScanPortal) {
  const existing = getPdfJob();
  if (existing) {
    // Job survived a remount — refresh auth so View / Save still work.
    try {
      await getAuth(portal);
      if (existing.portal !== portal) setPdfJob({ ...existing, portal });
      if (!existing.finished) schedule(0);
    } catch {
      // Keep the job; image fetch will retry auth.
    }
    return;
  }
  try {
    const { token, batchesUrl } = await getAuth(portal);
    const active = await fetchActivePdfBatchDirect(batchesUrl, token);
    if (!active || getPdfJob() || getScanBatch().length) return;
    resumedFinished = active.finished;
    begin(portal, active);
  } catch {
    // Nothing to resume.
  }
}

/** Stop reading on the server and forget sheets that were not saved. */
export async function stopPdfJob() {
  const job = getPdfJob();
  if (timer) clearTimeout(timer);
  timer = null;
  setPdfJob(null);
  if (!job || !auth) return;
  await dismissPdfBatchDirect(auth.batchesUrl, auth.token, job.batchId).catch(() => undefined);
}
