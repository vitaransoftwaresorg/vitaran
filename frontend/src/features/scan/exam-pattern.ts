/** OMR exam pattern — which subject bands to score after the test ID. */
export const EXAM_PATTERNS = ["MPCB", "PCB", "MPC", "MATH", "SCI", "MS"] as const;
export type ExamPattern = (typeof EXAM_PATTERNS)[number];

const PRIMARY_EXAM_PATTERNS = ["MATH", "SCI", "MS"] as const satisfies readonly ExamPattern[];
const SECONDARY_EXAM_PATTERNS = ["MPCB", "PCB", "MPC"] as const satisfies readonly ExamPattern[];

export const EXAM_PATTERN_OPTIONS: Array<{ value: ExamPattern; label: string }> = [
  { value: "MATH", label: "Maths" },
  { value: "SCI", label: "Sciences" },
  { value: "MS", label: "Maths Sciences" },
  { value: "MPCB", label: "MPCB · Maths, Physics, Chemistry, Biology" },
  { value: "PCB", label: "PCB · Physics, Chemistry, Biology" },
  { value: "MPC", label: "MPC · Maths, Physics, Chemistry" },
];

export function examPatternsForClassLevel(classLevel: number): readonly ExamPattern[] {
  return classLevel <= 5 ? PRIMARY_EXAM_PATTERNS : SECONDARY_EXAM_PATTERNS;
}

export function examPatternOptionsForClassLevel(classLevel: number) {
  const allowed = new Set(examPatternsForClassLevel(classLevel));
  return EXAM_PATTERN_OPTIONS.filter((row) => allowed.has(row.value));
}

export function isExamPattern(value: string): value is ExamPattern {
  return (EXAM_PATTERNS as readonly string[]).includes(value);
}
