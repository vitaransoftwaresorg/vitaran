import {
  PUBLIC_RESULTS_PATH,
  RESULTS_PATH,
  SCHOOL_RESULTS_PATH,
  TEACHER_RESULTS_PATH,
} from "./constants";

export type ResultsFolderCrumb = { label: string; href: string };

const RESULTS_FOLDER_STORAGE = "vitaran:results-folder";
const RESULTS_FOLDER_CRUMBS = "vitaran:results-folder-crumbs";

export function resultsTestFolderHref(basePath: string, testNumber: number) {
  const query = new URLSearchParams({ test: String(testNumber) });
  return `${basePath}?${query}`;
}

export function isResultsFolderHref(href: string) {
  const pathOnly = href.split("?")[0];
  return (
    !href.includes("://") &&
    (pathOnly === RESULTS_PATH ||
      pathOnly === SCHOOL_RESULTS_PATH ||
      pathOnly === TEACHER_RESULTS_PATH ||
      pathOnly === PUBLIC_RESULTS_PATH)
  );
}

/** Safe redirect target after a deleted / missing result sheet (prefer ?from= folder). */
export function safeResultsReturnHref(
  from: string | string[] | undefined,
  fallback: string,
): string {
  const value = Array.isArray(from) ? from[0] : from;
  if (!value || value.includes("://") || value.includes("..")) return fallback;
  return isResultsFolderHref(value) ? value : fallback;
}

export function isResultDetailPath(pathname: string) {
  return /\/results\/[^/]+$/.test(pathname);
}

export function writeResultsFolderTrail(href: string, crumbs: ResultsFolderCrumb[]) {
  if (typeof window === "undefined") return;
  try {
    if (isResultsFolderHref(href)) {
      window.sessionStorage.setItem(RESULTS_FOLDER_STORAGE, href);
    }
    window.sessionStorage.setItem(RESULTS_FOLDER_CRUMBS, JSON.stringify(crumbs));
  } catch {
    // ignore
  }
}

export function readResultsFolderCrumbs(): ResultsFolderCrumb[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(RESULTS_FOLDER_CRUMBS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const { label, href } = row as Record<string, unknown>;
      if (typeof label !== "string" || typeof href !== "string" || !label.trim() || !href.trim()) {
        return [];
      }
      return [{ label, href }];
    });
  } catch {
    return [];
  }
}

/** Last results drive folder (usually Test N), so Back from a class sheet returns there. */
export function readResultsReturnHref() {
  if (typeof window === "undefined") return null;
  const from = new URLSearchParams(window.location.search).get("from");
  if (from && isResultsFolderHref(from)) return from;
  try {
    const stored = window.sessionStorage.getItem(RESULTS_FOLDER_STORAGE);
    if (stored && isResultsFolderHref(stored)) return stored;
  } catch {
    // ignore
  }
  return null;
}
