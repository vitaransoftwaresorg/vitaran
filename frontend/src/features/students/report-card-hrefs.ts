import type { PerformancePortal, ReportCardKind } from "./portal";

const PROFILE_BASE: Record<PerformancePortal, string> = {
  admin: "/admin/schools/students",
  school: "/school/students",
  teacher: "/teacher/students",
};

export const studentPdfHref = (portal: PerformancePortal, id: string, download = false) =>
  `${PROFILE_BASE[portal]}/${encodeURIComponent(id)}/pdf${download ? "?download=1" : ""}`;

export const studentRankCardsHref = (portal: PerformancePortal, id: string, download = false) =>
  `${PROFILE_BASE[portal]}/${encodeURIComponent(id)}/rank-cards${download ? "?download=1" : ""}`;

export const studentReportCardHref = (
  portal: PerformancePortal,
  id: string,
  kind: ReportCardKind,
  options?: { download?: boolean; subject?: string; test?: number },
) => {
  const query = new URLSearchParams({ kind });
  if (options?.subject) query.set("subject", options.subject);
  if (options?.test != null) query.set("test", String(options.test));
  if (options?.download) query.set("download", "1");
  return `${PROFILE_BASE[portal]}/${encodeURIComponent(id)}/report-cards?${query}`;
};

export const classReportCardsHref = (
  portal: PerformancePortal,
  studentIds: string[],
  kind: ReportCardKind,
  options?: { download?: boolean; subject?: string; test?: number },
) => {
  const query = new URLSearchParams({
    kind,
    ids: studentIds.join(","),
  });
  if (options?.subject) query.set("subject", options.subject);
  if (options?.test != null) query.set("test", String(options.test));
  if (options?.download) query.set("download", "1");
  return `${PROFILE_BASE[portal]}/report-cards?${query}`;
};

export const classProfilesPdfHref = (portal: PerformancePortal, studentIds: string[], download = false) =>
  `${PROFILE_BASE[portal]}/profiles/pdf?ids=${studentIds.map(encodeURIComponent).join(",")}${download ? "&download=1" : ""}`;
