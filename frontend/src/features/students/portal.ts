/** Shared portal role for student profile / performance / PDF routes (client-safe). */
export type PerformancePortal = "admin" | "school" | "teacher";

/** Report card PDF kind — keep out of server-only modules so client UI can import it. */
export type ReportCardKind = "year" | "tests" | "subjects";

/** Selectable test numbers for Tests Report menus (matches results drive). */
export const REPORT_TEST_NUMBERS = Array.from({ length: 18 }, (_, index) => index + 1);
