/** OMR exam pattern — which subject bands to score after the test ID. */
export const EXAM_PATTERNS = ["MPCB", "PCB", "MPC"] as const;
export type ExamPattern = (typeof EXAM_PATTERNS)[number];

export const EXAM_PATTERN_OPTIONS: Array<{ value: ExamPattern; label: string }> = [
  { value: "MPCB", label: "MPCB · Maths, Physics, Chemistry, Biology" },
  { value: "PCB", label: "PCB · Physics, Chemistry, Biology" },
  { value: "MPC", label: "MPC · Maths, Physics, Chemistry" },
];

export function isExamPattern(value: string): value is ExamPattern {
  return (EXAM_PATTERNS as readonly string[]).includes(value);
}
