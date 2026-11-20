import type { ReportCardKind } from "./portal";

/** User-facing empty copy for Year / Tests / Subjects report downloads. */
export function emptyReportMessage(
  kind: ReportCardKind,
  options?: { subject?: string; test?: number },
) {
  if (kind === "year") return "No year report records yet";
  if (kind === "subjects") {
    const subject = options?.subject?.trim();
    return subject
      ? `No subjects report records for ${subject} yet`
      : "No subjects report records yet";
  }
  return options?.test != null
    ? `No tests report records for Test ${options.test} yet`
    : "No tests report records yet";
}
