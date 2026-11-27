import type { SubjectRange } from "../utils/answer-key-parse.js";

/** OMR exam pattern — controls which subject bands are scored. */
export const EXAM_PATTERNS = ["MPCB", "PCB", "MPC", "MATH", "SCI", "MS"] as const;
export type ExamPattern = (typeof EXAM_PATTERNS)[number];

/** Classes 1–5 (primary / Olympiad). */
export const PRIMARY_EXAM_PATTERNS = ["MATH", "SCI", "MS"] as const satisfies readonly ExamPattern[];
/** Classes 6–12. */
export const SECONDARY_EXAM_PATTERNS = ["MPCB", "PCB", "MPC"] as const satisfies readonly ExamPattern[];

export const EXAM_PATTERN_LABELS: Record<ExamPattern, string> = {
  MPCB: "MPCB · Maths, Physics, Chemistry, Biology",
  PCB: "PCB · Physics, Chemistry, Biology",
  MPC: "MPC · Maths, Physics, Chemistry",
  MATH: "Maths",
  SCI: "Sciences",
  MS: "Maths Sciences",
};

/** Fixed paper order; question numbers stay within each subject’s band. */
export const EXAM_PATTERN_SUBJECTS: Record<ExamPattern, readonly string[]> = {
  MPCB: ["MATHEMATICS", "PHYSICS", "CHEMISTRY", "BIOLOGY"],
  PCB: ["PHYSICS", "CHEMISTRY", "BIOLOGY"],
  MPC: ["MATHEMATICS", "PHYSICS", "CHEMISTRY"],
  MATH: ["MATHEMATICS"],
  SCI: ["SCIENCE"],
  MS: ["MATHEMATICS", "SCIENCE"],
};

export function examPatternsForClassLevel(classLevel: number): readonly ExamPattern[] {
  return classLevel <= 5 ? PRIMARY_EXAM_PATTERNS : SECONDARY_EXAM_PATTERNS;
}

export function defaultExamPatternForClassLevel(classLevel: number): ExamPattern {
  return classLevel <= 5 ? "MS" : "MPCB";
}

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
