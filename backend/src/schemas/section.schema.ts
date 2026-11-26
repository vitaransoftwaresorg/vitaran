import { z } from "zod";

const optionalSectionName = z
  .string()
  .trim()
  .max(32)
  .transform((value) => {
    const next = value.toUpperCase();
    return next.length === 0 ? null : next;
  })
  .nullable()
  .optional();

const requiredSectionName = z
  .string()
  .trim()
  .min(1, "Section name is required")
  .max(32)
  .transform((value) => value.toUpperCase());

/** Legacy DB column — not enforced; school seat limit is the only cap. */
const optionalSeatCount = z.number().int().min(1).max(5000).optional().default(5000);

/** OMR subject pattern for the class/section — scored at scan time from this value. */
export const examPatternSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.enum(["MPCB", "PCB", "MPC"]));

export const createSectionSchema = z.object({
  classLevel: z.number().int().min(1).max(12),
  /** Omit / blank = Section A (default when the class has no other sections). */
  name: optionalSectionName,
  programId: z.uuid(),
  studentCount: optionalSeatCount,
  examPattern: examPatternSchema,
  classTeacherId: z.uuid().nullable().optional(),
  applyTeacherToClass: z.boolean().optional().default(false),
});

export const updateSectionSchema = z
  .object({
    name: requiredSectionName,
    programId: z.uuid(),
    studentCount: z.number().int().min(1).max(5000).optional(),
    examPattern: examPatternSchema,
    classTeacherId: z.uuid().nullable(),
    applyTeacherToClass: z.boolean().optional().default(false),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const updateSchoolClassSchema = z
  .object({
    programId: z.uuid(),
    studentCount: z.number().int().min(1).max(5000).optional(),
    examPattern: examPatternSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const sectionIdParamsSchema = z.object({
  id: z.uuid(),
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type UpdateSchoolClassInput = z.infer<typeof updateSchoolClassSchema>;
