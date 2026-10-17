"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ADMIN_BASE_PATH, SCHOOL_BASE_PATH } from "@/constants/auth";
import { ApiError } from "@/services/api-client";
import * as teacherService from "@/services/teachers";
import type {
  ClassTeacherSlotInput,
  TeacherAssignmentInput,
  TeacherInput,
  TeacherStatus,
} from "@/types/teacher";
import { SUBJECTS, type Subject } from "@/types/school";

const assignmentSchema = z.object({
  programId: z.uuid(),
  classLevel: z.coerce.number().int().min(1).max(12),
  subject: z.enum(SUBJECTS),
});

const classTeacherSlotSchema = z.object({
  programId: z.uuid(),
  classLevel: z.coerce.number().int().min(1).max(12),
});

const teacherSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the teacher's full name.")
    .max(120, "Keep the name under 120 characters."),
  email: z.email({ error: "Enter a valid email address." }).trim().toLowerCase(),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a 10-digit phone number."),
  status: z.enum(["ACTIVE", "INACTIVE"], { error: "Select a status." }),
  password: z.string().max(128, "Keep the password under 128 characters."),
  assignments: z.array(assignmentSchema).min(1, "Assign at least one class and subject."),
  classTeacherFor: z.array(classTeacherSlotSchema).default([]),
});

export type TeacherFormValues = {
  name: string;
  email: string;
  phone: string;
  status: string;
  password: string;
  assignments: string[];
  classTeacherFor: string[];
};

export type TeacherFormState =
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<keyof TeacherFormValues | "assignments", string[]>>;
      values: TeacherFormValues;
      submittedAt: number;
    }
  | { status: "success"; teacherId: string }
  | undefined;

function readValues(formData: FormData): TeacherFormValues {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    status: String(formData.get("status") ?? "ACTIVE"),
    password: String(formData.get("password") ?? ""),
    assignments: formData.getAll("assignments").map(String),
    classTeacherFor: formData.getAll("classTeacherFor").map(String),
  };
}

function parseAssignments(raw: string[]): TeacherAssignmentInput[] {
  return raw
    .map((value) => {
      const [programId, classLevel, subject] = value.split(":");
      return {
        programId,
        classLevel: Number(classLevel),
        subject: subject as Subject,
      };
    })
    .filter((item) => item.programId && item.classLevel && item.subject);
}

function parseClassTeacherSlots(raw: string[]): ClassTeacherSlotInput[] {
  return raw
    .map((value) => {
      const [programId, classLevel] = value.split(":");
      return { programId, classLevel: Number(classLevel) };
    })
    .filter((item) => item.programId && item.classLevel);
}

function toInput(values: TeacherFormValues, requirePassword: boolean): TeacherInput | null {
  const parsed = teacherSchema.safeParse({
    ...values,
    password: values.password,
    assignments: parseAssignments(values.assignments),
    classTeacherFor: parseClassTeacherSlots(values.classTeacherFor),
  });
  if (!parsed.success) return null;

  if (requirePassword && !parsed.data.password) return null;

  const { password, ...rest } = parsed.data;
  return password ? { ...rest, password } : rest;
}

function fieldErrorsFrom(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as TeacherFormState extends { fieldErrors?: infer F }
    ? F
    : never;
}

async function saveTeacher(
  formData: FormData,
  mode: "create" | "edit",
  save: (input: TeacherInput) => Promise<{ id: string }>,
  revalidate: string,
): Promise<TeacherFormState> {
  const values = readValues(formData);
  const parsed = teacherSchema.safeParse({
    ...values,
    assignments: parseAssignments(values.assignments),
    classTeacherFor: parseClassTeacherSlots(values.classTeacherFor),
  });

  if (!parsed.success) {
    return {
      status: "error",
      values,
      fieldErrors: fieldErrorsFrom(parsed.error),
      submittedAt: Date.now(),
    };
  }

  if (mode === "create" && !parsed.data.password) {
    return {
      status: "error",
      values,
      fieldErrors: { password: ["Enter a password."] },
      submittedAt: Date.now(),
    };
  }

  const input = toInput(values, mode === "create");
  if (!input) {
    return {
      status: "error",
      values,
      message: "Check the highlighted fields.",
      submittedAt: Date.now(),
    };
  }

  try {
    const teacher = await save(input);
    revalidatePath(revalidate, "layout");
    return { status: "success", teacherId: teacher.id };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && (error.status === 400 || error.status === 409)) {
      return { status: "error", values, message: error.message, submittedAt: Date.now() };
    }
    return {
      status: "error",
      values,
      message: "We couldn't save the teacher. Please try again.",
      submittedAt: Date.now(),
    };
  }
}

export async function createSchoolTeacherAction(
  _state: TeacherFormState,
  formData: FormData,
): Promise<TeacherFormState> {
  return saveTeacher(formData, "create", teacherService.createSchoolTeacher, SCHOOL_BASE_PATH);
}

export async function updateSchoolTeacherAction(
  teacherId: string,
  _state: TeacherFormState,
  formData: FormData,
): Promise<TeacherFormState> {
  return saveTeacher(
    formData,
    "edit",
    (input) => teacherService.updateSchoolTeacher(teacherId, input),
    SCHOOL_BASE_PATH,
  );
}

function revalidateSchoolTeacherViews() {
  revalidatePath(`${SCHOOL_BASE_PATH}/classes`, "layout");
  revalidatePath(`${SCHOOL_BASE_PATH}/teachers`, "layout");
  revalidatePath(SCHOOL_BASE_PATH, "layout");
}

export async function setSchoolTeacherStatusAction(teacherId: string, status: TeacherStatus) {
  try {
    await teacherService.setSchoolTeacherStatus(teacherId, status);
    revalidateSchoolTeacherViews();
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "Could not update teacher status." };
  }
}

export async function deleteSchoolTeacherAction(teacherId: string) {
  try {
    await teacherService.deleteSchoolTeacher(teacherId);
    revalidateSchoolTeacherViews();
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "Could not delete teacher." };
  }
}

export async function createAdminTeacherAction(
  schoolId: string,
  _state: TeacherFormState,
  formData: FormData,
): Promise<TeacherFormState> {
  return saveTeacher(
    formData,
    "create",
    (input) => teacherService.createAdminTeacher(schoolId, input),
    ADMIN_BASE_PATH,
  );
}

export async function updateAdminTeacherAction(
  teacherId: string,
  _state: TeacherFormState,
  formData: FormData,
): Promise<TeacherFormState> {
  return saveTeacher(
    formData,
    "edit",
    (input) => teacherService.updateAdminTeacher(teacherId, input),
    ADMIN_BASE_PATH,
  );
}

export async function setAdminTeacherStatusAction(teacherId: string, status: TeacherStatus) {
  try {
    await teacherService.setAdminTeacherStatus(teacherId, status);
    revalidatePath(ADMIN_BASE_PATH, "layout");
    // Class-teacher slots live on the school portal — keep Classes in sync.
    revalidateSchoolTeacherViews();
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "Could not update teacher status." };
  }
}

export async function setClassTeacherAction(input: {
  programId: string;
  classLevel: number;
  teacherId: string | null;
}) {
  try {
    await teacherService.setSchoolClassTeacher(input);
    revalidatePath(`${SCHOOL_BASE_PATH}/classes`, "layout");
    revalidatePath(SCHOOL_BASE_PATH, "layout");
    return { ok: true as const };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not save class teacher." };
  }
}
