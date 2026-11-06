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

export function clearScanBatch() {
  items = [];
  emit();
}

/** Test ID entered for this upload session, kept after failed scans and review round-trips. */
let lastTestId = "";

export function getLastTestId() {
  return lastTestId;
}

export function setLastTestId(value: string) {
  lastTestId = value;
}

export function subscribeScanBatch(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
