import { z } from "zod";
import { ANSWER_OPTIONS } from "../utils/answer-key-parse.js";

const option = z.enum(ANSWER_OPTIONS);
const question = z
  .string()
  .regex(/^(?:[1-9]|[1-9]\d|100)$/, "Question must be 1–100");

export const extractedAnswersSchema = z.record(question, z.array(option).min(1).max(4));

export const extractedSheetSchema = z.object({
  rollNo: z.string().regex(/^\d{6,7}$/, "Registration number must be 6 or 7 digits"),
  rollCandidates: z.array(z.string()),
  printedName: z.string(),
  testId: z.string(),
  testCandidates: z.array(z.string()),
  examDate: z.string(),
  answers: extractedAnswersSchema,
  flags: z.array(z.object({ question: z.number().int().positive(), reason: z.string() })),
  markCount: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
});

export type ExtractedSheet = z.infer<typeof extractedSheetSchema>;

export function parseExtractedSheet(value: unknown): ExtractedSheet {
  return extractedSheetSchema.parse(value);
}
