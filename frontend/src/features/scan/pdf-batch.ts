"use client";

import { toast } from "sonner";
import type { ScanPortal } from "@/services/scans";
import type { PdfBatchSummary } from "@/types/scan";
import { getPdfJob, getScanBatch, setPdfJob, setScanBatch, type PdfFailure, type PdfJob } from "./batch-store";
import {
  dismissPdfBatchDirect,
  fetchActivePdfBatchDirect,
  fetchPdfBatchDirect,
  fetchPdfPageImageDirect,
} from "./client-upload";
import { getOmrUploadAuthAction } from "./upload-auth";

const POLL_MS = 2000;
/** Network blips are retried; after this many failures in a row the page stops asking. */
const MAX_POLL_ERRORS = 10;

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

function summarize(job: PdfJob) {
  const parts = [`${job.read} sheet${job.read === 1 ? "" : "s"} read`];
  if (job.duplicates) parts.push(`${job.duplicates} duplicate${job.duplicates === 1 ? "" : "s"} skipped`);
  if (job.failures.length) parts.push(`${job.failures.length} failed`);
  return parts.join(" · ");
}

const failureLine = (failure: PdfFailure) => `Page ${failure.page}: ${failure.message}`;

function onFinished() {
  const job = getPdfJob();
  if (!job) return;
  if (!getScanBatch().length && !job.failures.length) {
    // Every sheet was saved already; a PDF picked up again after a reload has nothing left to say.
    if (!resumedFinished) toast.success(`PDF done · ${summarize(job)}`);
    void stopPdfJob();
    return;
  }
  if (resumedFinished) return;
  if (job.failures.length) {
    toast.warning(`PDF read · ${summarize(job)}`, {
      description:
        job.failures.slice(0, 6).map(failureLine).join("\n") +
        (job.failures.length > 6 ? `\n+${job.failures.length - 6} more` : "") +
        "\nView or scan them again under “Pages that could not be read”.",
      duration: 15000,
      classNames: { description: "whitespace-pre-line" },
    });
  } else toast.success(`PDF read · ${summarize(job)}`);
}

/** A failed page was scanned again and read: it leaves the failed list. */
export function resolvePdfFailure(page: number) {
  const job = getPdfJob();
  if (!job) return;
  setPdfJob({ ...job, failures: job.failures.filter((failure) => failure.page !== page) });
}

/** Object URL of a failed PDF page, as rendered on the server. */
export async function fetchFailedPageImage(page: number) {
  const job = getPdfJob();
  if (!job || !auth) throw new Error("This PDF is no longer open.");
  return fetchPdfPageImageDirect(auth.batchesUrl, auth.token, job.batchId, page);
}

async function poll() {
  timer = null;
  const job = getPdfJob();
  if (!job || job.finished || !auth) return;
  try {
    const status = await fetchPdfBatchDirect(auth.batchesUrl, auth.token, job.batchId, job.next);
    errors = 0;
    if (getPdfJob()?.batchId !== job.batchId) return;
    const previews = status.items.flatMap((item) => (item.preview ? [item.preview] : []));
    if (previews.length) setScanBatch([...getScanBatch(), ...previews]);
    const next = job.next + status.items.length;
    setPdfJob({
      ...job,
      done: status.done,
      finished: status.finished && next >= status.done,
      next,
      read: job.read + previews.length,
      failures: [
        ...job.failures,
        ...status.items.flatMap((item) =>
          item.error && !item.duplicateOf
            ? [{ page: item.page, message: item.error, hasImage: Boolean(item.hasImage) }]
            : [],
        ),
      ],
      duplicates: job.duplicates + status.items.filter((item) => item.duplicateOf).length,
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

function begin(summary: PdfBatchSummary) {
  setPdfJob({
    batchId: summary.batchId,
    fileName: summary.fileName,
    testId: summary.testId,
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
export async function startPdfJob(portal: ScanPortal, summary: PdfBatchSummary) {
  await getAuth(portal);
  resumedFinished = false;
  begin(summary);
}

/** Back on the scan page after a reload or another tab: carry on with the PDF still on the server. */
export async function resumePdfJob(portal: ScanPortal) {
  if (getPdfJob()) return;
  try {
    const { token, batchesUrl } = await getAuth(portal);
    const active = await fetchActivePdfBatchDirect(batchesUrl, token);
    if (!active || getPdfJob() || getScanBatch().length) return;
    resumedFinished = active.finished;
    begin(active);
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
