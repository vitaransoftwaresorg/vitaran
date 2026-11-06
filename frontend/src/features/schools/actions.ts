"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ADMIN_BASE_PATH, SCHOOL_BASE_PATH, TEACHER_BASE_PATH } from "@/constants/auth";
import { ApiError } from "@/services/api-client";
import * as schoolService from "@/services/schools";
import type { SchoolInput } from "@/types/school";
import {
  getSchoolFormSchema,
  readFormValues,
  toSchoolInput,
  withoutPasswords,
  type SchoolFormErrors,
  type SchoolFormField,
  type SchoolFormMode,
  type SchoolFormState,
  type SchoolFormValues,
} from "./schema";

/** Program/class checks drive Classes, Resources, answer keys, and teacher views. */
function revalidateSchoolPortalViews() {
  revalidatePath(ADMIN_BASE_PATH, "layout");
  revalidatePath(`${ADMIN_BASE_PATH}/programs`);
  revalidatePath(SCHOOL_BASE_PATH, "layout");
  revalidatePath(`${SCHOOL_BASE_PATH}/classes`);
  revalidatePath(`${SCHOOL_BASE_PATH}/resources`);
  revalidatePath(`${SCHOOL_BASE_PATH}/answer-keys`);
  revalidatePath(`${SCHOOL_BASE_PATH}/teachers`);
  revalidatePath(TEACHER_BASE_PATH, "layout");
  revalidatePath(`${TEACHER_BASE_PATH}/resources`);
  revalidatePath(`${TEACHER_BASE_PATH}/answer-keys`);
}

function mapApiField(path: unknown): SchoolFormField | undefined {
  if (!Array.isArray(path) || typeof path[0] !== "string") return undefined;
  const root = path[0];
  if (root === "programs") return "offerings";
  if (root === "customProgram") {
    return path[1] === "classes" ? "customClasses" : "customProgramName";
  }
  return root as SchoolFormField;
}

function fieldErrorsFromApi(details: unknown) {
  if (!Array.isArray(details)) return undefined;

  const fieldErrors: SchoolFormErrors = {};

  for (const issue of details) {
    const field = mapApiField(issue?.path);
    if (field && typeof issue.message === "string") {
      (fieldErrors[field] ??= []).push(issue.message);
    }
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

// Admins can already see an existing school's password, so edits keep it in the form.
function errorState(
  mode: SchoolFormMode,
  values: SchoolFormValues,
  extra: { message?: string; fieldErrors?: SchoolFormErrors },
): SchoolFormState {
  return {
    status: "error",
    values: mode === "edit" ? values : withoutPasswords(values),
    submittedAt: Date.now(),
    ...extra,
  };
}

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function logoFromForm(formData: FormData): File | null {
  const logo = formData.get("logo");
  if (!(logo instanceof File) || logo.size <= 0) return null;
  return logo;
}

function logoFieldError(file: File): string | null {
  if (!LOGO_TYPES.has(file.type)) return "Upload a PNG, JPEG, or WebP logo.";
  if (file.size > LOGO_MAX_BYTES) return "Logo must be under 2 MB.";
  return null;
}

async function saveSchool(
  formData: FormData,
  mode: SchoolFormMode,
  save: (input: SchoolInput) => Promise<{ id: string }>,
): Promise<SchoolFormState> {
  const values = readFormValues(formData);
  const parsed = getSchoolFormSchema(mode).safeParse(values);
  const logo = logoFromForm(formData);
  const removeLogo = String(formData.get("removeLogo") ?? "") === "1";

  if (!parsed.success) {
    return errorState(mode, values, { fieldErrors: z.flattenError(parsed.error).fieldErrors });
  }

  if (logo) {
    const logoError = logoFieldError(logo);
    if (logoError) {
      return errorState(mode, values, { fieldErrors: { logo: [logoError] } });
    }
  }

  try {
    const school = await save(toSchoolInput(parsed.data));
    if (logo) {
      await schoolService.uploadSchoolLogo(school.id, logo);
    } else if (removeLogo && mode === "edit") {
      try {
        await schoolService.deleteSchoolLogo(school.id);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
    }
    revalidateSchoolPortalViews();
    return { status: "success", schoolId: school.id, submittedAt: Date.now() };
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof ApiError && (error.status === 400 || error.status === 409)) {
      const fieldErrors = fieldErrorsFromApi(error.details);
      return errorState(mode, values, fieldErrors ? { fieldErrors } : { message: error.message });
    }

    if (error instanceof ApiError && error.status === 404) {
      return errorState(mode, values, { message: "This school no longer exists." });
    }

    if (error instanceof ApiError && error.status < 500) {
      return errorState(mode, values, { message: error.message });
    }

    console.error("Failed to save school", error);
    return errorState(mode, values, {
      message: "We couldn't save the school right now. Please try again.",
    });
  }
}

export async function createSchoolAction(
  _state: SchoolFormState,
  formData: FormData,
): Promise<SchoolFormState> {
  return saveSchool(formData, "create", schoolService.createSchool);
}

export async function updateSchoolAction(
  schoolId: string,
  _state: SchoolFormState,
  formData: FormData,
): Promise<SchoolFormState> {
  return saveSchool(formData, "edit", (input) =>
    schoolService.updateSchool(schoolId, input),
  );
}

/** Fails open: the create/update request still rejects duplicates. */
export async function isEmailTakenAction(
  email: string,
  excludeId?: string,
): Promise<boolean> {
  const parsed = z.email().safeParse(email.trim().toLowerCase());
  if (!parsed.success) return false;

  try {
    const { emailTaken } = await schoolService.getAccountAvailability(parsed.data, excludeId);
    return emailTaken;
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}

export async function deleteSchoolAction(
  schoolId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await schoolService.deleteSchool(schoolId);
    revalidateSchoolPortalViews();
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof ApiError && error.status === 404) {
      revalidateSchoolPortalViews();
      return { ok: false, message: "This school was already deleted." };
    }
    return { ok: false, message: "We couldn't delete the school. Please try again." };
  }
}

export async function sendSchoolCredentialsAction(schoolId: string) {
  try {
    const result = await schoolService.sendSchoolCredentials(schoolId);
    return { ok: true as const, to: result.to };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not send credentials." };
  }
}

export async function resetSchoolPasswordAction(schoolId: string, password: string) {
  try {
    const result = await schoolService.resetSchoolPassword(schoolId, password);
    revalidatePath(`${ADMIN_BASE_PATH}/schools/${schoolId}`);
    return { ok: true as const, to: result.to };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not reset password." };
  }
}
