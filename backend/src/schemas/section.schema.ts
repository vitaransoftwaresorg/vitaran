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

export const createSectionSchema = z.object({
  classLevel: z.number().int().min(1).max(12),
  /** Omit / blank = Section A (default when the class has no other sections). */
  name: optionalSectionName,
  programId: z.uuid(),
  studentCount: z.number().int().min(1).max(5000),
  classTeacherId: z.uuid().nullable().optional(),
  applyTeacherToClass: z.boolean().optional().default(false),
});

export const updateSectionSchema = z
  .object({
    name: requiredSectionName,
    programId: z.uuid(),
    studentCount: z.number().int().min(1).max(5000),
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
    studentCount: z.number().int().min(1).max(5000),
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
