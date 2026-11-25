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

function majorityKey<T>(counts: Map<T, number>): T | undefined {
  let best: T | undefined;
  let bestN = 0;
  for (const [key, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = key;
    }
  }
  return best;
}

/** School that appears most often in the current PDF/photo batch (for walk-in save). */
export function majoritySchoolIdFromBatch(): string | undefined {
  const counts = new Map<string, number>();
  for (const item of items) {
    const id = item.scan.student.schoolId?.trim();
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return majorityKey(counts);
}

/**
 * Walk-in placement from the PDF/photo batch: majority school, then majority
 * class + program among that school's sheets.
 */
export function majorityWalkInFromBatch(): {
  schoolId?: string;
  classLevel?: number;
  programCode?: string;
} {
  const schoolId = majoritySchoolIdFromBatch();
  if (!schoolId) return {};
  const inSchool = items.filter((item) => item.scan.student.schoolId?.trim() === schoolId);
  const classCounts = new Map<number, number>();
  const programCounts = new Map<string, number>();
  for (const item of inSchool) {
    const level = item.scan.student.classLevel;
    if (typeof level === "number" && level >= 1) {
      classCounts.set(level, (classCounts.get(level) ?? 0) + 1);
    }
    const code = item.scan.student.programCode?.trim();
    if (code) programCounts.set(code, (programCounts.get(code) ?? 0) + 1);
  }
  return {
    schoolId,
    classLevel: majorityKey(classCounts),
    programCode: majorityKey(programCounts),
  };
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

export type PdfJobKeyInfo = {
  programName: string;
  classLevel: number;
  testNumber: number;
  sectionName?: string | null;
};

/** PDF being read on the server; its sheets are appended to the batch as they finish. */
export type PdfJob = {
  batchId: string;
  fileName: string;
  testId: string;
  examPattern: string;
  /** Portal that started this job — used to refresh upload auth after a reload. */
  portal: "admin" | "school" | "teacher";
  /** Answer-key lines for this test ID (program / class) shown while reading. */
  keys: PdfJobKeyInfo[];
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

export type PdfFailure = {
  page: number;
  message: string;
  hasImage: boolean;
  /** Duplicate reg that was read — shown so the examiner enters a different one. */
  rollNo?: string;
  /** Scored pending from scan time — bind reg without re-reading bubbles. */
  previewId?: string;
  total?: number;
  maxTotal?: number;
};

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
