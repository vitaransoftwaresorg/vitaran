import { z } from "zod";
import { SchoolType } from "../generated/prisma/enums.js";
import { subjectCodeSchema } from "../utils/subject.js";

const CLASS = z.number().int().min(1).max(12);

const programFields = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(SchoolType).default(SchoolType.REGULAR),
  year: z.number().int().min(2020).max(2100),
  classFrom: CLASS,
  classTo: CLASS,
  subjects: z
    .array(subjectCodeSchema)
    .min(1, "Select at least one subject")
    .transform((subjects) => [...new Set(subjects)]),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,63}$/, "Code must be letters, numbers and underscores"),
});

const classRangeOk = <T extends { classFrom?: number; classTo?: number }>(value: T) => {
  if (value.classFrom === undefined || value.classTo === undefined) return true;
  return value.classFrom <= value.classTo;
};

export const createProgramSchema = programFields.refine(classRangeOk, {
  message: "Class from must be ≤ class to",
  path: ["classTo"],
});

export const updateProgramSchema = programFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  })
  .refine(classRangeOk, {
    message: "Class from must be ≤ class to",
    path: ["classTo"],
  });

export const programIdParamsSchema = z.object({
  id: z.uuid(),
});

export const programCodeAvailabilityQuerySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,63}$/, "Code must be letters, numbers and underscores"),
  excludeId: z.uuid().optional(),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;
export type ProgramCodeAvailabilityQuery = z.infer<typeof programCodeAvailabilityQuerySchema>;
