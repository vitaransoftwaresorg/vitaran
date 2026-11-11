import { z } from "zod";

/** Stable catalog key: "Computer Science" → "COMPUTER_SCIENCE". */
export function normalizeSubjectCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}

/** "COMPUTER_SCIENCE" → "Computer Science". */
export function subjectLabelFromCode(code: string) {
  return code
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const subjectCodeSchema = z
  .string()
  .trim()
  .min(1, "Enter a subject")
  .max(80)
  .transform(normalizeSubjectCode)
  .refine((value) => value.length >= 2, "Enter a subject");

/** Same bands as regular catalog: Olympiad Primary 1–5, Advanced/Integrated 6–10. */
const PRIMARY_CLASS_SUBJECTS = ["MATHEMATICS", "SCIENCE"];
const SECONDARY_CLASS_SUBJECTS = ["MATHEMATICS", "PHYSICS", "CHEMISTRY", "BIOLOGY"];

export function subjectsForClassLevel(classLevel: number) {
  return classLevel <= 5 ? [...PRIMARY_CLASS_SUBJECTS] : [...SECONDARY_CLASS_SUBJECTS];
}
