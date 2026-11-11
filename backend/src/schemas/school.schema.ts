import { z } from "zod";
import { titleCase, titleText } from "../utils/title-case.js";
import {
  SchoolBoard,
  SchoolStatus,
  SchoolType,
} from "../generated/prisma/enums.js";
import { subjectCodeSchema } from "../utils/subject.js";

const requiredText = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const email = z.email().trim().toLowerCase().max(254);

const phone = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{10,14}$/, "Invalid phone number"));

const password = z.string().min(1, "Password is required").max(128);

const schoolProgramClassSchema = z.object({
  classLevel: z.number().int().min(1).max(12),
  subjects: z
    .array(subjectCodeSchema)
    .min(1, "Select at least one subject for each class")
    .transform((subjects) => [...new Set(subjects)]),
});

const schoolProgramClassesSchema = z
  .array(schoolProgramClassSchema)
  .min(1, "Select at least one class for each program")
  .transform((classes) => {
    const byClass = new Map<number, (typeof classes)[number]>();
    for (const row of classes) byClass.set(row.classLevel, row);
    return [...byClass.values()].sort((a, b) => a.classLevel - b.classLevel);
  });

const schoolProgramSchema = z.object({
  programId: z.uuid(),
  classes: schoolProgramClassesSchema,
});

/** Created with the school — no catalog row needs to exist first. */
const customProgramSchema = z.object({
  name: requiredText(2, 120),
  classes: schoolProgramClassesSchema,
});

/** Freeform school ID — any non-empty string. */
const schoolCode = z.string().trim().min(1, "School ID is required").max(64, "Keep the school ID under 64 characters");

const schoolFields = {
  code: schoolCode,
  name: titleText(2, 200),
  board: z.enum(SchoolBoard),
  type: z.enum(SchoolType),
  status: z.enum(SchoolStatus),
  programs: z
    .array(schoolProgramSchema)
    .default([])
    .transform((programs) => {
      const byId = new Map<string, (typeof programs)[number]>();
      for (const row of programs) byId.set(row.programId, row);
      return [...byId.values()];
    }),
  customProgram: customProgramSchema.optional(),
  principalName: optionalText(120).transform((value) => (value ? titleCase(value) : value)),
  contactName: titleText(2, 120),
  contactEmail: email,
  contactPhone: phone,
  addressLine: requiredText(5, 300),
  city: titleText(2, 100),
  state: requiredText(2, 100),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Invalid pincode"),
  studentStrength: z.number().int().min(1).max(100_000).nullable().optional(),
  notes: optionalText(1000),
  accountEmail: email,
  accountPhone: phone,
};

export const createSchoolSchema = z
  .object({
    ...schoolFields,
    type: schoolFields.type.default(SchoolType.REGULAR),
    status: schoolFields.status.default(SchoolStatus.ACTIVE),
    password,
  })
  .superRefine((data, ctx) => {
    if (data.type === SchoolType.CUSTOMIZED && !data.customProgram) {
      ctx.addIssue({
        code: "custom",
        path: ["customProgram"],
        message: "Enter a program name and select classes",
      });
    }
  });

export const updateSchoolSchema = z
  .object({ ...schoolFields, password })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const schoolIdParamsSchema = z.object({
  id: z.uuid(),
});

export const resetSchoolPasswordSchema = z.object({
  password: z.string().min(4, "Use at least 4 characters").max(128),
});

export type ResetSchoolPasswordInput = z.infer<typeof resetSchoolPasswordSchema>;

export const accountAvailabilityQuerySchema = z.object({
  email,
  excludeId: z.uuid().optional(),
});

export const codeAvailabilityQuerySchema = z.object({
  code: schoolCode,
  excludeId: z.uuid().optional(),
});

export const listSchoolsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(SchoolStatus).optional(),
  board: z.enum(SchoolBoard).optional(),
  type: z.enum(SchoolType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(["createdAt", "name", "city"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const listSchoolOptionsQuerySchema = z.object({
  type: z.enum(SchoolType).optional(),
  status: z.enum(SchoolStatus).optional(),
});

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
export type ListSchoolsQuery = z.infer<typeof listSchoolsQuerySchema>;
export type ListSchoolOptionsQuery = z.infer<typeof listSchoolOptionsQuerySchema>;
export type AccountAvailabilityQuery = z.infer<typeof accountAvailabilityQuerySchema>;
export type CodeAvailabilityQuery = z.infer<typeof codeAvailabilityQuerySchema>;
export type SchoolProgramInput = z.infer<typeof schoolProgramSchema>;
export type CustomProgramInput = z.infer<typeof customProgramSchema>;
