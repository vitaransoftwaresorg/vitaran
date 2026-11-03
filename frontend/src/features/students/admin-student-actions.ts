"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/services/api-client";
import {
  createAdminSchoolStudent,
  deleteAdminStudent,
  getAdminStudent,
  resetAdminStudentPassword,
  sendAdminStudentCredentials,
  updateAdminStudent,
} from "@/services/students";
import type { CreateStudentInput } from "@/types/student";
import type { StudentFormState } from "@/features/students/actions";

const studentSchema = z.object({
  name: z.string().trim().min(2, "Enter the student name"),
  rollNo: z.string().trim().min(1, "Enter the registration number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  programId: z.string().min(1, "Pick a program").uuid("Pick a program"),
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

  const msg = error.message;
  if (/roll|registration/i.test(msg)) return { rollNo: [msg] };
  if (/section/i.test(msg)) return { sectionId: [msg] };
  if (/seat|full|strength/i.test(msg)) return { sectionId: [msg] };
  if (/program|class/i.test(msg)) return { programId: [msg] };
  if (/email/i.test(msg)) return { email: [msg] };
  return undefined;
}

function revalidateAdminStudentPaths(schoolId?: string) {
  revalidatePath(`/admin/schools/students`);
  if (schoolId) {
    revalidatePath(`/admin/schools/${schoolId}`);
    revalidatePath(`/admin/schools/${schoolId}/students`);
  }
}

export async function createAdminStudentAction(
  schoolId: string,
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

  try {
    const student = await createAdminSchoolStudent(schoolId, {
      name: data.name,
      rollNo: data.rollNo,
      email: data.email || null,
      programId: data.programId,
      classLevel: data.classLevel,
      sectionId: data.sectionId || null,
      password: data.password || undefined,
    });
    revalidateAdminStudentPaths(schoolId);
    redirect(`/admin/schools/students/${student.id}`);
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

export async function updateAdminStudentAction(
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
  const returnTo =
    String(formData.get("returnTo") ?? "").trim() || `/admin/schools/students/${id}`;

  try {
    const student = await updateAdminStudent(id, {
      name: data.name,
      rollNo: data.rollNo,
      email: data.email || null,
      programId: data.programId,
      classLevel: data.classLevel,
      sectionId: data.sectionId || null,
      ...(data.password ? { password: data.password } : {}),
    });
    revalidateAdminStudentPaths(student.schoolId);
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

export async function deleteAdminStudentInPlaceAction(id: string) {
  const student = await getAdminStudent(id);
  await deleteAdminStudent(id);
  revalidateAdminStudentPaths(student?.schoolId);
  return { ok: true as const };
}

export async function sendAdminStudentCredentialsAction(id: string) {
  try {
    const student = await getAdminStudent(id);
    await sendAdminStudentCredentials(id);
    return { ok: true as const, to: student?.email ?? "" };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not send credentials." };
  }
}

export async function resetAdminStudentPasswordAction(id: string, password: string) {
  try {
    const result = await resetAdminStudentPassword(id, password);
    revalidateAdminStudentPaths(result.schoolId);
    return { ok: true as const, to: result.email ?? "" };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not reset password." };
  }
}
