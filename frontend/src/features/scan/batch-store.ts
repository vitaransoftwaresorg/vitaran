import type { ScanPreview } from "@/types/scan";

/** In-memory PDF/photo batch — survives client navigations, cleared on hard refresh. */
let items: ScanPreview[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getScanBatch(): ScanPreview[] {
  return items;
}

export function setScanBatch(next: ScanPreview[]) {
  items = next;
  emit();
}

export function removeScanBatchAt(index: number): ScanPreview[] {
  items = items.filter((_, i) => i !== index);
  emit();
  return items;
}

export function removeScanBatchById(previewId: string): ScanPreview[] {
  items = items.filter((item) => item.previewId !== previewId);
  emit();
  return items;
}

export function clearScanBatch() {
  items = [];
  emit();
}

/** PDF being read on the server; its sheets are appended to the batch as they finish. */
export type PdfJob = {
  batchId: string;
  fileName: string;
  testId: string;
  pageCount: number;
  done: number;
  finished: boolean;
  /** Server items already pulled into the batch. */
  next: number;
  /** Sheets added to the batch from this PDF (some may be saved already). */
  read: number;
  /** Pages that could not be read and have not been scanned again yet. */
  failures: PdfFailure[];
  duplicates: number;
};

export type PdfFailure = { page: number; message: string; hasImage: boolean };

let pdfJob: PdfJob | null = null;

export function getPdfJob() {
  return pdfJob;
}

export function setPdfJob(next: PdfJob | null) {
  pdfJob = next;
  emit();
}

export function subscribeScanBatch(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
