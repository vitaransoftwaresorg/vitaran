"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/services/api-client";
import {
  createAdminSchoolStudent,
  createAdminSchoolStudentsBulk,
  deleteAdminClassStudents,
  deleteAdminSectionStudents,
  deleteAdminStudent,
  findStudentIdByRoll,
  getAdminStudent,
  updateAdminStudent,
} from "@/services/students";
import type {
  BulkStudentRowInput,
  CreateStudentInput,
  CreateStudentsBulkInput,
} from "@/types/student";
import type {
  BulkStudentFormState,
  SchoolImportFormState,
  SchoolImportGroupInput,
  StudentFormState,
} from "@/features/students/actions";
import { revalidateAdminRoster } from "@/features/students/revalidate-roster";

/** Blank / null / whitespace → ""; otherwise min 2 chars. */
const optionalStudentName = z.preprocess(
  (value) => (value == null ? "" : String(value).trim()),
  z.union([
    z.literal(""),
    z.string().min(2, "Enter at least 2 characters").max(120),
  ]),
);

const optionalParentName = z.preprocess(
  (value) => (value == null ? "" : String(value).trim()),
  z.union([
    z.literal(""),
    z.string().min(2, "Enter a parent / guardian name (at least 2 characters)"),
  ]),
);

const optionalParentPhone = z.preprocess(
  (value) => String(value ?? "").replace(/\D/g, "").slice(0, 10),
  z.union([
    z.literal(""),
    z.string().regex(/^\d{10}$/, "Enter a 10-digit mobile number"),
  ]),
);

const optionalSectionId = z.preprocess(
  (value) => (value == null ? "" : value),
  z.union([z.literal(""), z.string().uuid("Pick a valid section")]),
);

const studentSchema = z.object({
  name: optionalStudentName,
  rollNo: z.string().trim().regex(/^\d{7}$/, "Enter the 7-digit registration number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  parentName: optionalParentName,
  parentPhone: optionalParentPhone,
  programId: z.string().min(1, "Pick a program").uuid("Pick a program"),
  classLevel: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number({ error: "Pick a class" }).int().min(1, "Pick a class").max(12),
  ),
  sectionId: optionalSectionId,
});

const bulkRowSchema = z.object({
  name: optionalStudentName,
  rollNo: z.string().trim().regex(/^\d{7}$/, "Enter the 7-digit registration number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  parentName: optionalParentName,
  parentPhone: optionalParentPhone,
  sectionId: optionalSectionId.optional(),
});

function formValues(formData: FormData): Partial<CreateStudentInput> {
  return {
    name: String(formData.get("name") ?? ""),
    rollNo: String(formData.get("rollNo") ?? ""),
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

function revalidateAdminStudentPaths(schoolId?: string) {
  revalidateAdminRoster(schoolId);
}

export async function createAdminStudentAction(
  schoolId: string,
  _state: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const values = formValues(formData);
  const parsed = studentSchema.safeParse({
    ...values,
    email: "",
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
  const returnTo =
    String(formData.get("returnTo") ?? "").trim() ||
    `/admin/schools/students?school=${schoolId}`;

  try {
    await createAdminSchoolStudent(schoolId, {
      name: data.name,
      rollNo: data.rollNo,
      email: null,
      parentName: data.parentName || null,
      parentPhone: data.parentPhone || null,
      programId: data.programId,
      classLevel: data.classLevel,
      sectionId: data.sectionId || null,
    });
    revalidateAdminStudentPaths(schoolId);
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

/** Import many students across classes for one school — one bulk call per class/section group. */
export async function importAdminStudentsAllAction(
  schoolId: string,
  input: {
    groups: SchoolImportGroupInput[];
    returnTo?: string;
    stay?: boolean;
  },
): Promise<SchoolImportFormState> {
  if (!input.groups.length) return { message: "Import at least one student" };

  let total = 0;
  const importRowErrors: Record<number, Record<string, string>> = {};

  try {
    for (const group of input.groups) {
      if (!group.programId || group.classLevel == null) {
        return { message: "Each student needs a class that is set up for this school" };
      }

      const validRows: BulkStudentRowInput[] = [];
      const sourceByPayload: number[] = [];

      for (const row of group.students) {
        const blank =
          !(row.name ?? "").trim() &&
          !(row.rollNo ?? "").trim() &&
          !(row.parentName ?? "").trim() &&
          !(row.parentPhone ?? "").trim();
        if (blank) continue;

        const parsed = bulkRowSchema.safeParse({
          name: row.name ?? "",
          rollNo: row.rollNo ?? "",
          email: "",
          parentName: row.parentName ?? "",
          parentPhone: row.parentPhone ?? "",
          sectionId: row.sectionId ?? "",
        });
        if (!parsed.success) {
          const flat = z.flattenError(parsed.error).fieldErrors;
          importRowErrors[row.sourceIndex] = Object.fromEntries(
            Object.entries(flat).map(([key, value]) => [key, value?.[0] ?? "Invalid"]),
          );
          continue;
        }
        sourceByPayload.push(row.sourceIndex);
        validRows.push({
          name: String(parsed.data.name ?? ""),
          rollNo: parsed.data.rollNo,
          email: null,
          parentName: parsed.data.parentName || null,
          parentPhone: parsed.data.parentPhone || null,
          sectionId: parsed.data.sectionId || row.sectionId || null,
        });
      }

      if (Object.keys(importRowErrors).length > 0) {
        return { message: "Fix the highlighted rows", importRowErrors };
      }
      if (validRows.length === 0) continue;

      for (let offset = 0; offset < validRows.length; offset += 300) {
        const chunk = validRows.slice(offset, offset + 300);
        const chunkSources = sourceByPayload.slice(offset, offset + 300);
        try {
          const result = await createAdminSchoolStudentsBulk(schoolId, {
            programId: group.programId,
            classLevel: group.classLevel,
            sectionId: group.sectionId ?? null,
            students: chunk,
          });
          total += result.count;
        } catch (error) {
          unstable_rethrow(error);
          if (error instanceof ApiError) {
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
                    const sourceIndex = chunkSources[Number(path[1])];
                    if (sourceIndex != null) {
                      importRowErrors[sourceIndex] = {
                        ...(importRowErrors[sourceIndex] ?? {}),
                        [path[2]]: (item as { message: string }).message,
                      };
                    }
                  }
                }
              }
            }
            return {
              message:
                Object.keys(importRowErrors).length > 0
                  ? total > 0
                    ? `Saved ${total} student${total === 1 ? "" : "s"}, then hit an error — fix the highlighted rows`
                    : "Fix the highlighted rows"
                  : total > 0
                    ? `Saved ${total} student${total === 1 ? "" : "s"}, then: ${error.message}`
                    : error.message,
              importRowErrors:
                Object.keys(importRowErrors).length > 0 ? importRowErrors : undefined,
              count: total || undefined,
            };
          }
          throw error;
        }
      }
    }

    revalidateAdminStudentPaths(schoolId);
    if (total === 0) return { message: "Enter at least one student" };
    if (input.stay) return { success: true, count: total };
    redirect(
      input.returnTo?.trim() || `/admin/schools/students?school=${schoolId}`,
    );
  } catch (error) {
    unstable_rethrow(error);
    throw error;
  }
}

export async function createAdminStudentsBulkAction(
  schoolId: string,
  input: {
    programId: string;
    classLevel: number;
    sectionId?: string | null;
    students: BulkStudentRowInput[];
    returnTo?: string;
    stay?: boolean;
  },
): Promise<BulkStudentFormState> {
  if (!input.programId) return { message: "Pick a program" };
  if (!input.classLevel) return { message: "Pick a class" };

  const rowErrors: Record<number, Record<string, string>> = {};
  const validRows: BulkStudentRowInput[] = [];
  const uiIndexByPayload: number[] = [];

  input.students.forEach((row, index) => {
    const blank =
      !(row.name ?? "").trim() &&
      !(row.rollNo ?? "").trim() &&
      !(row.parentName ?? "").trim() &&
      !(row.parentPhone ?? "").trim();
    if (blank) return;

    const parsed = bulkRowSchema.safeParse({
      name: row.name ?? "",
      rollNo: row.rollNo ?? "",
      email: "",
      parentName: row.parentName ?? "",
      parentPhone: row.parentPhone ?? "",
      sectionId: row.sectionId ?? "",
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
      name: String(parsed.data.name ?? ""),
      rollNo: parsed.data.rollNo,
      email: null,
      parentName: parsed.data.parentName || null,
      parentPhone: parsed.data.parentPhone || null,
      sectionId: parsed.data.sectionId || row.sectionId || null,
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
    const result = await createAdminSchoolStudentsBulk(schoolId, payload);
    revalidateAdminStudentPaths(schoolId);
    if (input.stay) {
      return { success: true, count: result.count };
    }
    redirect(
      input.returnTo?.trim() || `/admin/schools/students?school=${schoolId}`,
    );
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

export async function updateAdminStudentAction(
  id: string,
  _state: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const values = formValues(formData);
  const parsed = studentSchema.safeParse({
    ...values,
    email: "",
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
  const returnTo =
    String(formData.get("returnTo") ?? "").trim() || `/admin/schools/students/${id}`;

  try {
    const student = await updateAdminStudent(id, {
      name: data.name,
      rollNo: data.rollNo,
      parentName: data.parentName || null,
      parentPhone: data.parentPhone || null,
      programId: data.programId,
      classLevel: data.classLevel,
      sectionId: data.sectionId || null,
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

export async function deleteAdminSectionStudentsAction(schoolId: string, sectionId: string) {
  try {
    const result = await deleteAdminSectionStudents(schoolId, sectionId);
    revalidateAdminStudentPaths(schoolId);
    return { ok: true as const, deleted: result.deleted };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not delete section students." };
  }
}

export async function deleteAdminClassStudentsAction(schoolId: string, classLevel: number) {
  try {
    const result = await deleteAdminClassStudents(schoolId, classLevel);
    revalidateAdminStudentPaths(schoolId);
    return { ok: true as const, deleted: result.deleted };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not delete class students." };
  }
}

/** Open a student profile from the admin Students page search. */
export async function findAdminStudentByRollAction(roll: string, schoolId?: string) {
  const normalized = roll.replace(/\D/g, "").slice(0, 7);
  if (!/^\d{7}$/.test(normalized)) {
    return { ok: false as const, message: "Enter the 7-digit registration number" };
  }
  try {
    const id = await findStudentIdByRoll("admin", normalized, schoolId);
    if (!id) {
      return {
        ok: false as const,
        message: schoolId
          ? `No student with registration number ${normalized} in this school`
          : `No student with registration number ${normalized}`,
      };
    }
    return { ok: true as const, id };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false as const, message: "Could not look up this registration number" };
  }
}

