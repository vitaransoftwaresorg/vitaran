import { classLabel } from "@/utils/format";

export const PDF_MAX_BYTES = 10 * 1024 * 1024;

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

export const TEST_NUMBERS = range(1, 18);
export const CLASS_LEVELS = range(1, 12);

export const testItems = TEST_NUMBERS.map((n) => ({ value: String(n), label: `Test No ${n}` }));
export const classItems = CLASS_LEVELS.map((n) => ({ value: String(n), label: classLabel(n) }));

/** `basePath` is the section the document lives under, e.g. `/admin/results` or `/results`. */
export const documentFileHref = (basePath: string, id: string) => `${basePath}/${id}/file`;
export const documentDownloadHref = (basePath: string, id: string) =>
  `${documentFileHref(basePath, id)}?download=1`;
export const documentEditHref = (basePath: string, id: string) => `${basePath}/${id}/edit`;
export const documentAnswersHref = (basePath: string, id: string, from?: string) => {
  const path = `${basePath}/${id}/answers`;
  if (!from) return path;
  return `${path}?${new URLSearchParams({ from })}`;
};

/** Saves within the same second as the upload aren't edits. */
export const wasEdited = ({ createdAt, updatedAt }: { createdAt: string; updatedAt: string }) =>
  new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** True when any of `fields` differs between the saved and the current form values. */
export function hasChanges<T extends Record<string, string | undefined>>(
  saved: T,
  current: T,
  fields: (keyof T)[],
) {
  return fields.some((field) => (saved[field] ?? "") !== (current[field] ?? ""));
}

/** "answer key" → "Answer key". */
export const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
