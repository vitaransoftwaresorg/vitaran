"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/services/api-client";
import {
  createSchoolStudent,
  createSchoolStudentsBulk,
  deleteSchoolStudent,
  getSchoolStudent,
  listSchoolStudents,
  updateSchoolStudent,
} from "@/services/students";
import type {
  BulkStudentRowInput,
  CreateStudentInput,
  CreateStudentsBulkInput,
  Student,
  StudentDetail,
} from "@/types/student";

export type StudentFormState = {
  values?: Partial<CreateStudentInput>;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  submittedAt?: number;
  success?: boolean;
  studentId?: string;
};

export type BulkStudentFormState = {
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  rowErrors?: Record<number, Record<string, string>>;
  success?: boolean;
  count?: number;
};

const studentSchema = z.object({
  name: z.string().trim().min(2, "Enter the student name"),
  rollNo: z.string().trim().regex(/^\d{7}$/, "Enter the 7-digit registration number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  parentName: z.string().trim().min(2, "Enter the parent / guardian name"),
  parentPhone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a 10-digit mobile number"),
  programId: z
    .string()
    .min(1, "Pick a program")
    .uuid("Pick a program"),
  classLevel: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number({ error: "Pick a class" }).int().min(1, "Pick a class").max(12),
  ),
  sectionId: z.union([z.literal(""), z.string().uuid("Pick a valid section")]),
});

const bulkRowSchema = z.object({
  name: z.string().trim().min(2, "Enter the student name"),
  rollNo: z.string().trim().regex(/^\d{7}$/, "Enter the 7-digit registration number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  parentName: z.string().trim().min(2, "Enter the parent / guardian name"),
  parentPhone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a 10-digit mobile number"),
});

function formValues(formData: FormData): Partial<CreateStudentInput> {
  return {
    name: String(formData.get("name") ?? ""),
    rollNo: String(formData.get("rollNo") ?? ""),
    email: String(formData.get("email") ?? "") || null,
    parentName: String(formData.get("parentName") ?? ""),
    parentPhone: String(formData.get("parentPhone") ?? "").replace(/\D/g, "").slice(0, 10),
    programId: String(formData.get("programId") ?? ""),
    classLevel: Number(formData.get("classLevel") || 0) || undefined,
    sectionId: String(formData.get("sectionId") ?? "") || null,
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
  if (/parent.?name/i.test(msg)) return { parentName: [msg] };
  if (/mobile|phone/i.test(msg)) return { parentPhone: [msg] };
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
      parentName: data.parentName,
      parentPhone: data.parentPhone,
      programId: data.programId,
      classLevel: data.classLevel,
      sectionId: data.sectionId || null,
    });
    revalidatePath("/school/classes");
    revalidatePath("/school/students");
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

export async function createSchoolStudentsBulkAction(input: {
  programId: string;
  classLevel: number;
  sectionId?: string | null;
  students: BulkStudentRowInput[];
  returnTo?: string;
  stay?: boolean;
}): Promise<BulkStudentFormState> {
  if (!input.programId) return { message: "Pick a program" };
  if (!input.classLevel) return { message: "Pick a class" };

  const rowErrors: Record<number, Record<string, string>> = {};
  const validRows: BulkStudentRowInput[] = [];
  const uiIndexByPayload: number[] = [];

  input.students.forEach((row, index) => {
    const blank =
      !row.name.trim() &&
      !row.rollNo.trim() &&
      !row.parentName.trim() &&
      !row.parentPhone.trim() &&
      !(row.email ?? "").trim();
    if (blank) return;

    const parsed = bulkRowSchema.safeParse({
      ...row,
      email: row.email ?? "",
      parentPhone: String(row.parentPhone ?? "").replace(/\D/g, "").slice(0, 10),
    });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      rowErrors[index] = Object.fromEntries(
        Object.entries(flat).map(([key, value]) => [key, value?.[0] ?? "Invalid"]),
      );
      return;
    }
    uiIndexByPayload.push(index);
    validRows.push({
      name: parsed.data.name,
      rollNo: parsed.data.rollNo,
      email: parsed.data.email || null,
      parentName: parsed.data.parentName,
      parentPhone: parsed.data.parentPhone,
    });
  });

  if (Object.keys(rowErrors).length > 0) {
    return { message: "Fix the highlighted rows", rowErrors };
  }
  if (validRows.length === 0) {
    return { message: "Enter at least one student" };
  }

  const payload: CreateStudentsBulkInput = {
    programId: input.programId,
    classLevel: input.classLevel,
    sectionId: input.sectionId || null,
    students: validRows,
  };

  try {
    const result = await createSchoolStudentsBulk(payload);
    revalidatePath("/school/classes");
    revalidatePath("/school/students");
    if (input.stay) {
      return { success: true, count: result.count };
    }
    redirect(input.returnTo?.trim() || "/school/students");
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      const fieldErrors = apiFieldErrors(error);
      const rowErrorsFromApi: Record<number, Record<string, string>> = {};
      if (Array.isArray(error.details)) {
        for (const item of error.details) {
          if (
            item &&
            typeof item === "object" &&
            "path" in item &&
            "message" in item &&
            Array.isArray((item as { path: unknown }).path)
          ) {
            const path = (item as { path: string[]; message: string }).path;
            if (path[0] === "students" && path[1] != null && path[2]) {
              const payloadIndex = Number(path[1]);
              const uiIndex = uiIndexByPayload[payloadIndex];
              if (uiIndex != null) {
                rowErrorsFromApi[uiIndex] = {
                  ...(rowErrorsFromApi[uiIndex] ?? {}),
                  [path[2]]: (item as { message: string }).message,
                };
              }
            }
          }
        }
      }
      return {
        message:
          Object.keys(rowErrorsFromApi).length > 0
            ? "Fix the highlighted rows"
            : error.message,
        fieldErrors,
        rowErrors: Object.keys(rowErrorsFromApi).length > 0 ? rowErrorsFromApi : undefined,
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
      parentName: data.parentName,
      parentPhone: data.parentPhone,
      programId: data.programId,
      classLevel: data.classLevel,
      sectionId: data.sectionId || null,
    });
    revalidatePath("/school/classes");
    revalidatePath("/school/students");
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
  revalidatePath("/school/students");
  redirect(returnTo);
}

export async function deleteStudentInPlaceAction(id: string) {
  await deleteSchoolStudent(id);
  revalidatePath("/school/classes");
  revalidatePath("/school/students");
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

