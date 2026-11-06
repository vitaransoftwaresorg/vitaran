import { z } from "zod";
import {
  AnswerKeyObjectionStatus,
} from "../generated/prisma/enums.js";

const answerOption = z.enum(["A", "B", "C", "D"]);
/** Claimed correct key: one/two letters, ADD bonus, or NONE (no right answer). */
export const proposedAnswerSchema = z.union([
  answerOption,
  z.literal("ADD"),
  z.literal("NONE"),
  z
    .string()
    .regex(/^[A-D]\/[A-D]$/, "Pick one or two options")
    .refine((value) => {
      const [a, b] = value.split("/") as [string, string];
      return a !== b;
    }, "Pick two different options"),
]);

/** Multipart forms send every field as text; empty means "not given". */
const blankToNull = (value: unknown) => (value === "" || value === "null" ? null : value);

export const raiseAnswerKeyObjectionSchema = z.object({
  message: z.string().trim().min(5, "Explain the objection").max(2000),
  questionNumber: z.preprocess(
    (value) => {
      const blank = blankToNull(value);
      return typeof blank === "string" ? Number(blank) : blank;
    },
    z.number().int().min(1).max(200).optional().nullable(),
  ),
  proposedAnswer: z.preprocess(blankToNull, proposedAnswerSchema.optional().nullable()),
}).superRefine((value, ctx) => {
  if (value.questionNumber != null && !value.proposedAnswer) {
    ctx.addIssue({
      code: "custom",
      path: ["proposedAnswer"],
      message: "Select what you think is correct (options, ADD, or no right answer)",
    });
  }
});

export const listAnswerKeyObjectionsQuerySchema = z.object({
  status: z.enum(AnswerKeyObjectionStatus).optional(),
  answerKeyId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const answerKeyObjectionIdParamsSchema = z.object({
  id: z.uuid(),
});

export const resolveAnswerKeyObjectionSchema = z.object({
  status: z.enum([AnswerKeyObjectionStatus.RESOLVED, AnswerKeyObjectionStatus.REJECTED]),
  resolutionNote: z.string().trim().min(3, "Add an explanation").max(2000),
});

export type RaiseAnswerKeyObjectionInput = z.infer<typeof raiseAnswerKeyObjectionSchema>;
export type ListAnswerKeyObjectionsQuery = z.infer<typeof listAnswerKeyObjectionsQuerySchema>;
export type ResolveAnswerKeyObjectionInput = z.infer<typeof resolveAnswerKeyObjectionSchema>;
