import { z } from "zod";
import { StudentStatus } from "../generated/prisma/enums.js";

const email = z.email().trim().toLowerCase().max(254);

const parentPhone = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{10,14}$/, "Invalid mobile number"));

const studentRowSchema = z.object({
  name: z.string().trim().min(2).max(120),
  rollNo: z.string().trim().min(1).max(64),
  email: email.optional().nullable(),
  parentName: z.string().trim().min(2).max(120),
  parentPhone,
});

export const createStudentSchema = studentRowSchema.extend({
  programId: z.uuid(),
  classLevel: z.number().int().min(1).max(12),
  sectionId: z.uuid().optional().nullable(),
  status: z.enum(StudentStatus).default(StudentStatus.ACTIVE),
});

export const createStudentsBulkSchema = z.object({
  programId: z.uuid(),
  classLevel: z.number().int().min(1).max(12),
  sectionId: z.uuid().optional().nullable(),
  students: z.array(studentRowSchema).min(1).max(100),
});

export const updateStudentSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    rollNo: z.string().trim().min(1).max(64),
    email: email.nullable(),
    parentName: z.string().trim().min(2).max(120),
    parentPhone,
    programId: z.uuid(),
    classLevel: z.number().int().min(1).max(12),
    sectionId: z.uuid().nullable(),
    status: z.enum(StudentStatus),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  schoolId: z.uuid().optional(),
  programId: z.uuid().optional(),
  classLevel: z.coerce.number().int().min(1).max(12).optional(),
  sectionId: z.uuid().optional(),
  /** When true, only students with no section (whole class). */
  wholeClass: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  status: z.enum(StudentStatus).optional(),
  q: z.string().trim().max(120).optional(),
});

export const studentIdParamsSchema = z.object({
  id: z.uuid(),
});

export const setStudentStatusSchema = z.object({
  status: z.enum(StudentStatus),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type CreateStudentsBulkInput = z.infer<typeof createStudentsBulkSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
