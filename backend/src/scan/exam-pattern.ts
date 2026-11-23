import type { SubjectRange } from "../utils/answer-key-parse.js";

/** OMR exam pattern chosen after the test ID — controls which subject bands are scored. */
export const EXAM_PATTERNS = ["MPCB", "PCB", "MPC"] as const;
export type ExamPattern = (typeof EXAM_PATTERNS)[number];

export const EXAM_PATTERN_LABELS: Record<ExamPattern, string> = {
  MPCB: "MPCB · Maths, Physics, Chemistry, Biology",
  PCB: "PCB · Physics, Chemistry, Biology",
  MPC: "MPC · Maths, Physics, Chemistry",
};

/** Fixed paper order; question numbers stay 1–25 / 26–50 / 51–75 / 76–100. */
export const EXAM_PATTERN_SUBJECTS: Record<ExamPattern, readonly string[]> = {
  MPCB: ["MATHEMATICS", "PHYSICS", "CHEMISTRY", "BIOLOGY"],
  PCB: ["PHYSICS", "CHEMISTRY", "BIOLOGY"],
  MPC: ["MATHEMATICS", "PHYSICS", "CHEMISTRY"],
};

export function parseExamPattern(value: unknown): ExamPattern | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toUpperCase();
  return (EXAM_PATTERNS as readonly string[]).includes(token) ? (token as ExamPattern) : null;
}

/** Keep only the pattern’s subjects; leave each band’s from/to unchanged. */
export function filterRangesForPattern(
  ranges: readonly SubjectRange[],
  pattern: ExamPattern | null | undefined,
): SubjectRange[] {
  if (!pattern) return [...ranges];
  const allowed = new Set(EXAM_PATTERN_SUBJECTS[pattern]);
  return ranges.filter((range) => allowed.has(range.subject));
}

/** Regrade: keep the same subjects the student was originally scored on. */
export function filterRangesForSubjects(
  ranges: readonly SubjectRange[],
  subjects: readonly string[],
): SubjectRange[] {
  if (subjects.length === 0) return [...ranges];
  const allowed = new Set(subjects);
  return ranges.filter((range) => allowed.has(range.subject));
}
