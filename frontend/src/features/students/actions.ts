"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/services/api-client";
import { revalidateSchoolRoster } from "@/features/students/revalidate-roster";
import {
  createSchoolStudent,
  createSchoolStudentsBulk,
  deleteSchoolClassStudents,
  deleteSchoolSectionStudents,
  deleteSchoolStudent,
  findStudentIdByRoll,
  getSchoolStudent,
  getTeacherStudent,
  listSchoolStudents,
  listTeacherStudents,
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
  programId: z
    .string()
    .min(1, "Pick a program")
    .uuid("Pick a program"),
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
  const stay = String(formData.get("stay") ?? "") === "1";
  const returnTo = String(formData.get("returnTo") ?? "").trim() || "/school/classes";

  try {
    const student = await createSchoolStudent({
      name: data.name,
      rollNo: data.rollNo,
      email: null,
      parentName: data.parentName || null,
      parentPhone: data.parentPhone || null,
      programId: data.programId,
      classLevel: data.classLevel,
      sectionId: data.sectionId || null,
    });
    revalidateSchoolRoster();
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

export type SchoolImportStudentInput = BulkStudentRowInput & {
  /** Excel / preview row index for error mapping. */
  sourceIndex: number;
};

export type SchoolImportGroupInput = {
  programId: string;
  classLevel: number;
  sectionId?: string | null;
  students: SchoolImportStudentInput[];
};

export type SchoolImportFormState = BulkStudentFormState & {
  /** Global Excel row index → field errors (school-wide import). */
  importRowErrors?: Record<number, Record<string, string>>;
};

function validateImportGroupStudents(students: SchoolImportStudentInput[]) {
  const importRowErrors: Record<number, Record<string, string>> = {};
  const validRows: BulkStudentRowInput[] = [];
  const sourceByPayload: number[] = [];

  for (const row of students) {
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

  return { importRowErrors, validRows, sourceByPayload };
}

function mapApiStudentErrors(
  error: ApiError,
  sourceByPayload: number[],
  into: Record<number, Record<string, string>>,
) {
  if (!Array.isArray(error.details)) return;
  for (const item of error.details) {
    if (
      !item ||
      typeof item !== "object" ||
      !("path" in item) ||
      !("message" in item) ||
      !Array.isArray((item as { path: unknown }).path)
    ) {
      continue;
    }
    const path = (item as { path: string[]; message: string }).path;
    if (path[0] !== "students" || path[1] == null || !path[2]) continue;
    const sourceIndex = sourceByPayload[Number(path[1])];
    if (sourceIndex == null) continue;
    into[sourceIndex] = {
      ...(into[sourceIndex] ?? {}),
      [path[2]]: (item as { message: string }).message,
    };
  }
}

/** Import many students across classes — one bulk call per class/section group. */
export async function importSchoolStudentsAllAction(input: {
  groups: SchoolImportGroupInput[];
  returnTo?: string;
  stay?: boolean;
}): Promise<SchoolImportFormState> {
  if (!input.groups.length) return { message: "Import at least one student" };

  let total = 0;
  const importRowErrors: Record<number, Record<string, string>> = {};

  try {
    for (const group of input.groups) {
      if (!group.programId || group.classLevel == null) {
        return { message: "Each student needs a class that is set up for this school" };
      }

      const validated = validateImportGroupStudents(group.students);
      Object.assign(importRowErrors, validated.importRowErrors);
      if (Object.keys(validated.importRowErrors).length > 0) {
        return { message: "Fix the highlighted rows", importRowErrors };
      }
      if (validated.validRows.length === 0) continue;

      // API max is 300 per request — chunk large class groups.
      for (let offset = 0; offset < validated.validRows.length; offset += 300) {
        const chunk = validated.validRows.slice(offset, offset + 300);
        const chunkSources = validated.sourceByPayload.slice(offset, offset + 300);
        try {
          const result = await createSchoolStudentsBulk({
            programId: group.programId,
            classLevel: group.classLevel,
            sectionId: group.sectionId ?? null,
            students: chunk,
          });
          total += result.count;
        } catch (error) {
          unstable_rethrow(error);
          if (error instanceof ApiError) {
            mapApiStudentErrors(error, chunkSources, importRowErrors);
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
    revalidateSchoolRoster();
    if (total === 0) return { message: "Enter at least one student" };
    if (input.stay) return { success: true, count: total };
    redirect(input.returnTo?.trim() || "/school/students");
  } catch (error) {
    unstable_rethrow(error);
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
    const result = await createSchoolStudentsBulk(payload);
    revalidateSchoolRoster();
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
  const stay = String(formData.get("stay") ?? "") === "1";
  const returnTo = String(formData.get("returnTo") ?? "").trim() || "/school/classes";

  try {
    await updateSchoolStudent(id, {
      name: data.name,
      rollNo: data.rollNo,
      parentName: data.parentName || null,
      parentPhone: data.parentPhone || null,
      programId: data.programId,
      classLevel: data.classLevel,
      sectionId: data.sectionId || null,
    });
    revalidateSchoolRoster();
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
    revalidateSchoolRoster();
  redirect(returnTo);
}

export async function deleteStudentInPlaceAction(id: string) {
  await deleteSchoolStudent(id);
    revalidateSchoolRoster();
  return { ok: true as const };
}

/** Delete all students in a section — keeps the class and section. */
export async function deleteSectionStudentsAction(sectionId: string) {
  try {
    const result = await deleteSchoolSectionStudents(sectionId);
    revalidateSchoolRoster();
    return { ok: true as const, deleted: result.deleted };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not delete section students." };
  }
}

/** Delete all students in a class — keeps class/section setup. */
export async function deleteClassStudentsAction(classLevel: number) {
  try {
    const result = await deleteSchoolClassStudents(classLevel);
    revalidateSchoolRoster();
    return { ok: true as const, deleted: result.deleted };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not delete class students." };
  }
}

export async function loadSchoolStudentAction(id: string): Promise<StudentDetail | null> {
  return getSchoolStudent(id);
}

export type PortalStudentPortal = "school" | "teacher";

/** Prefetch class roster so result-sheet profile opens are instant. */
export async function loadPortalClassStudentsAction(
  portal: PortalStudentPortal,
  classLevel: number,
): Promise<Student[]> {
  const params = { classLevel, pageSize: 200 };
  const list =
    portal === "school"
      ? await listSchoolStudents(params)
      : await listTeacherStudents(params);
  return list.items;
}

/** Resolve a result-sheet registration number to a portal student profile. */
export async function loadPortalStudentByRollAction(
  portal: PortalStudentPortal,
  roll: string,
): Promise<StudentDetail | null> {
  const id = await findStudentIdByRoll(portal, roll);
  if (!id) return null;
  if (portal === "school") return getSchoolStudent(id);
  return getTeacherStudent(id);
}

export async function loadSchoolRosterAction(params: {
  sectionId?: string;
  programId?: string;
  classLevel?: number;
  wholeClass?: boolean;
}): Promise<Student[]> {
  const list = await listSchoolStudents({ ...params, pageSize: 500 });
  return list.items;
}

