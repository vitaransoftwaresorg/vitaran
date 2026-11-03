"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ADMIN_BASE_PATH } from "@/constants/auth";
import { ApiError } from "@/services/api-client";
import * as programService from "@/services/programs";
import { SCHOOL_TYPES, toSubjectCode } from "@/types/school";

const programSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the program name.").max(120),
    type: z.enum(SCHOOL_TYPES, { error: "Select type." }),
    year: z.coerce.number().int().min(2020).max(2100),
    classFrom: z.coerce.number({ error: "Select class from." }).int().min(1, "Select class from.").max(12),
    classTo: z.coerce.number({ error: "Select class to." }).int().min(1, "Select class to.").max(12),
    subjects: z
      .array(z.string().trim().min(1).transform(toSubjectCode).refine((value) => value.length >= 2))
      .min(1, "Add at least one subject."),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9_]{1,63}$/, "Use letters, numbers and underscores (e.g. INTEGRATED)."),
  })
  .refine((value) => value.classFrom <= value.classTo, {
    message: "Class from must be ≤ class to.",
    path: ["classTo"],
  });

function fieldErrorsFromApi(details: unknown) {
  if (!Array.isArray(details)) return undefined;
  const fieldErrors: Partial<Record<keyof ProgramFormValues, string[]>> = {};
  for (const issue of details) {
    const field = issue?.path?.[0] as keyof ProgramFormValues | undefined;
    if (field && typeof issue.message === "string") {
      (fieldErrors[field] ??= []).push(issue.message);
    }
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

export type ProgramFormValues = {
  name: string;
  type: string;
  year: string;
  classFrom: string;
  classTo: string;
  subjects: string[];
  code: string;
};

export type ProgramFormState =
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<keyof ProgramFormValues, string[]>>;
      values: ProgramFormValues;
    }
  | { status: "success"; programId: string }
  | undefined;

function readValues(formData: FormData): ProgramFormValues {
  return {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    year: String(formData.get("year") ?? ""),
    classFrom: String(formData.get("classFrom") ?? ""),
    classTo: String(formData.get("classTo") ?? ""),
    subjects: formData.getAll("subjects").map(String),
    code: String(formData.get("code") ?? ""),
  };
}

async function save(
  formData: FormData,
  persist: (input: z.infer<typeof programSchema>) => Promise<{ id: string }>,
): Promise<ProgramFormState> {
  const values = readValues(formData);
  const parsed = programSchema.safeParse({
    ...values,
    subjects: values.subjects,
  });

  if (!parsed.success) {
    return {
      status: "error",
      values,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const program = await persist(parsed.data);
    revalidatePath(ADMIN_BASE_PATH, "layout");
    return { status: "success", programId: program.id };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && (error.status === 400 || error.status === 409)) {
      const fieldErrors = fieldErrorsFromApi(error.details);
      return { status: "error", values, message: fieldErrors ? undefined : error.message, fieldErrors };
    }
    return { status: "error", values, message: "Could not save the program. Please try again." };
  }
}

export async function createProgramAction(
  _state: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  return save(formData, (input) => programService.createProgram(input));
}

export async function updateProgramAction(
  id: string,
  _state: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  return save(formData, (input) => programService.updateProgram(id, input));
}

const PROGRAM_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

export async function isProgramCodeTakenAction(code: string, excludeId?: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  if (!PROGRAM_CODE.test(normalized)) return false;
  try {
    const { taken } = await programService.getProgramCodeAvailability(normalized, excludeId);
    return taken;
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}

export async function deleteProgramAction(id: string) {
  try {
    await programService.deleteProgram(id);
    revalidatePath(ADMIN_BASE_PATH, "layout");
    return { ok: true as const };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not delete the program." };
  }
}
