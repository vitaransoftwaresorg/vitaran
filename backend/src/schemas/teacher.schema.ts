import { z } from "zod";
import { titleText } from "../utils/title-case.js";
import { TeacherStatus } from "../generated/prisma/enums.js";
import { subjectCodeSchema } from "../utils/subject.js";

const email = z.email().trim().toLowerCase().max(254);

const phone = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{10,14}$/, "Invalid phone number"));

const password = z.string().min(1, "Password is required").max(128);

const assignmentSchema = z.object({
  programId: z.uuid(),
  classLevel: z.number().int().min(1).max(12),
  subject: subjectCodeSchema,
});

/** Class-level CT when no sections; section CT when sections exist. */
const classTeacherSlotSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("class"),
    programId: z.uuid(),
    classLevel: z.number().int().min(1).max(12),
  }),
  z.object({
    kind: z.literal("section"),
    sectionId: z.uuid(),
  }),
]);

const teacherFields = {
  name: titleText(2, 120),
  email,
  phone,
  status: z.enum(TeacherStatus),
  assignments: z
    .array(assignmentSchema)
    .min(1, "Assign at least one class and subject")
    .transform((assignments) => {
      const seen = new Set<string>();
      return assignments.filter((item) => {
        const key = `${item.programId}:${item.classLevel}:${item.subject}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }),
  classTeacherFor: z
    .array(classTeacherSlotSchema)
    .default([])
    .transform((slots) => {
      const seen = new Set<string>();
      return slots.filter((item) => {
        const key =
          item.kind === "class"
            ? `class:${item.programId}:${item.classLevel}`
            : `section:${item.sectionId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }),
};

export const createTeacherSchema = z.object({
  ...teacherFields,
  status: teacherFields.status.default(TeacherStatus.ACTIVE),
  password,
});

export const updateTeacherSchema = z
  .object({ ...teacherFields, password })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const setTeacherStatusSchema = z.object({
  status: z.enum(TeacherStatus),
});

export const resetTeacherPasswordSchema = z.object({
  password: z.string().min(4, "Use at least 4 characters").max(128),
});

export type ResetTeacherPasswordInput = z.infer<typeof resetTeacherPasswordSchema>;

export const teacherIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listTeachersQuerySchema = z.object({
  schoolId: z.uuid().optional(),
  search: z.string().trim().max(100).optional(),
  status: z.enum(TeacherStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export const setClassTeacherSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("class"),
    programId: z.uuid(),
    classLevel: z.number().int().min(1).max(12),
    teacherId: z.uuid().nullable(),
  }),
  z.object({
    kind: z.literal("section"),
    sectionId: z.uuid(),
    teacherId: z.uuid().nullable(),
    applyToClass: z.boolean().optional().default(false),
  }),
]);

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
export type ListTeachersQuery = z.infer<typeof listTeachersQuerySchema>;
export type SetTeacherStatusInput = z.infer<typeof setTeacherStatusSchema>;
export type SetClassTeacherInput = z.infer<typeof setClassTeacherSchema>;
export type ClassTeacherSlotInput = z.infer<typeof classTeacherSlotSchema>;
