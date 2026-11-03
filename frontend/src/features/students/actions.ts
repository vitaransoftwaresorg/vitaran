"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/services/api-client";
import {
  createSchoolStudent,
  deleteSchoolStudent,
  getSchoolStudent,
  listSchoolStudents,
  resetSchoolStudentPassword,
  sendSchoolStudentCredentials,
  updateSchoolStudent,
} from "@/services/students";
import type { CreateStudentInput, Student, StudentDetail } from "@/types/student";

export type StudentFormState = {
  values?: Partial<CreateStudentInput>;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  submittedAt?: number;
  success?: boolean;
  studentId?: string;
};

const studentSchema = z.object({
  name: z.string().trim().min(2, "Enter the student name"),
  rollNo: z.string().trim().min(1, "Enter the registration number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  programId: z
    .string()
    .min(1, "Pick a program")
    .uuid("Pick a program"),
  classLevel: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number({ error: "Pick a class" }).int().min(1, "Pick a class").max(12),
  ),
  sectionId: z.union([z.literal(""), z.string().uuid("Pick a valid section")]),
  password: z.string().max(128),
});

function formValues(formData: FormData): Partial<CreateStudentInput> {
  return {
    name: String(formData.get("name") ?? ""),
    rollNo: String(formData.get("rollNo") ?? ""),
    email: String(formData.get("email") ?? "") || null,
    programId: String(formData.get("programId") ?? ""),
    classLevel: Number(formData.get("classLevel") || 0) || undefined,
    sectionId: String(formData.get("sectionId") ?? "") || null,
    password: String(formData.get("password") ?? "") || undefined,
  };
}

function apiFieldErrors(error: ApiError): Record<string, string[] | undefined> | undefined {
  const details = error.details;
  const out: Record<string, string[]> = {};
  if (Array.isArray(details)) {
    for (const item of details) {
      if (
        item &&
        typeof item === "object" &&
        "path" in item &&
        "message" in item &&
        Array.isArray((item as { path: unknown }).path)
      ) {
        const path = (item as { path: string[]; message: string }).path.join(".") || "_";
        out[path] = [...(out[path] ?? []), (item as { message: string }).message];
      }
    }
  }
  if (Object.keys(out).length > 0) return out;

  // Fall back so seat / uniqueness messages still land on a field.
  const msg = error.message;
  if (/roll|registration/i.test(msg)) return { rollNo: [msg] };
  if (/section/i.test(msg)) return { sectionId: [msg] };
  if (/seat|full|strength/i.test(msg)) return { sectionId: [msg] };
  if (/program|class/i.test(msg)) return { programId: [msg] };
  if (/email/i.test(msg)) return { email: [msg] };
  return undefined;
}

export async function createStudentAction(
  _state: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const values = formValues(formData);
  const parsed = studentSchema.safeParse({
    ...values,
    email: values.email ?? "",
    sectionId: values.sectionId ?? "",
    password: values.password ?? "",
  });

  if (!parsed.success) {
    return {
      values,
      fieldErrors: z.flattenError(parsed.error).fieldErrors as StudentFormState["fieldErrors"],
      submittedAt: Date.now(),
    };
  }

  const data = parsed.data;
  const stay = String(formData.get("stay") ?? "") === "1";
  const returnTo = String(formData.get("returnTo") ?? "").trim() || "/school/classes";

  try {
    const student = await createSchoolStudent({
      name: data.name,
      rollNo: data.rollNo,
      email: data.email || null,
      programId: data.programId,
      classLevel: data.classLevel,
      sectionId: data.sectionId || null,
      password: data.password || undefined,
    });
    revalidatePath("/school/classes");
    if (stay) {
      return { success: true, studentId: student.id, submittedAt: Date.now() };
    }
    redirect(returnTo);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      const fieldErrors = apiFieldErrors(error);
      return {
        values,
        message: fieldErrors ? undefined : error.message,
        fieldErrors,
        submittedAt: Date.now(),
      };
    }
    throw error;
  }
}

export async function updateStudentAction(
  id: string,
  _state: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const values = formValues(formData);
  const parsed = studentSchema.safeParse({
    ...values,
    email: values.email ?? "",
    sectionId: values.sectionId ?? "",
    password: values.password ?? "",
  });

  if (!parsed.success) {
    return {
      values,
      fieldErrors: z.flattenError(parsed.error).fieldErrors as StudentFormState["fieldErrors"],
      submittedAt: Date.now(),
    };
  }

  const data = parsed.data;
  const stay = String(formData.get("stay") ?? "") === "1";
  const returnTo = String(formData.get("returnTo") ?? "").trim() || "/school/classes";

  try {
    await updateSchoolStudent(id, {
      name: data.name,
      rollNo: data.rollNo,
      email: data.email || null,
      programId: data.programId,
      classLevel: data.classLevel,
      sectionId: data.sectionId || null,
      ...(data.password ? { password: data.password } : {}),
    });
    revalidatePath("/school/classes");
    if (stay) {
      return { success: true, studentId: id, submittedAt: Date.now() };
    }
    redirect(returnTo);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      const fieldErrors = apiFieldErrors(error);
      return {
        values,
        message: fieldErrors ? undefined : error.message,
        fieldErrors,
        submittedAt: Date.now(),
      };
    }
    throw error;
  }
}

export async function deleteStudentAction(id: string, returnTo = "/school/classes") {
  await deleteSchoolStudent(id);
  revalidatePath("/school/classes");
  redirect(returnTo);
}

export async function deleteStudentInPlaceAction(id: string) {
  await deleteSchoolStudent(id);
  revalidatePath("/school/classes");
  return { ok: true as const };
}

export async function loadSchoolStudentAction(id: string): Promise<StudentDetail | null> {
  return getSchoolStudent(id);
}

export async function loadSchoolRosterAction(params: {
  sectionId?: string;
  programId?: string;
  classLevel?: number;
  wholeClass?: boolean;
}): Promise<Student[]> {
  const list = await listSchoolStudents({ ...params, pageSize: 100 });
  return list.items;
}

export async function sendStudentCredentialsAction(id: string) {
  try {
    const student = await getSchoolStudent(id);
    await sendSchoolStudentCredentials(id);
    return { ok: true as const, to: student?.email ?? "" };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not send credentials." };
  }
}

export async function resetStudentPasswordAction(id: string, password: string) {
  try {
    const result = await resetSchoolStudentPassword(id, password);
    revalidatePath("/school/classes");
    return { ok: true as const, to: result.email ?? "" };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not reset password." };
  }
}
