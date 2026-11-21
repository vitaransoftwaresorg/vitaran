"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ADMIN_BASE_PATH, SCHOOL_BASE_PATH, TEACHER_BASE_PATH } from "@/constants/auth";
import { ApiError } from "@/services/api-client";
import * as programService from "@/services/programs";
import * as schoolService from "@/services/schools";
import * as sectionService from "@/services/sections";
import type { SchoolInput, SchoolType, Subject } from "@/types/school";
import type { SchoolProgramOffering } from "@/types/program";
import type { SectionInput } from "@/types/section";
import { subjectsForClassLevel } from "./constants";
import { CUSTOM_DRAFT_PROGRAM_ID, seedRegularProgramsInput } from "./offerings";
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
  save: (input: SchoolInput) => Promise<{ id: string; schoolPrograms: SchoolProgramOffering[] }>,
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
    await applyPendingClassChanges(school.id, school.schoolPrograms, formData);
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

/** Persist type immediately on the edit page (no full form Save). */
export async function updateSchoolTypeAction(
  schoolId: string,
  type: SchoolType,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const school = await schoolService.getSchool(schoolId);
    if (!school) return { ok: false, message: "School not found." };
    if ((school.type ?? "REGULAR") === type) return { ok: true };

    if (type === "CUSTOMIZED") {
      let organization: Awaited<ReturnType<typeof sectionService.listAdminSchoolSections>> | null =
        null;
      try {
        organization = await sectionService.listAdminSchoolSections(schoolId);
      } catch {
        organization = null;
      }

      const subjectsByClass = new Map<number, Subject[]>();
      for (const program of school.schoolPrograms) {
        for (const row of program.classes) {
          if (!subjectsByClass.has(row.classLevel) && row.subjects.length > 0) {
            subjectsByClass.set(row.classLevel, [...row.subjects]);
          }
        }
      }

      const levels = [
        ...new Set([
          ...school.schoolPrograms.flatMap((program) =>
            program.classes.map((row) => row.classLevel),
          ),
          ...(organization?.wholeClasses ?? []).map((row) => row.classLevel),
          ...(organization?.sections ?? []).map((row) => row.classLevel),
        ]),
      ]
        .filter((level) => Number.isInteger(level) && level >= 1 && level <= 12)
        .sort((a, b) => a - b);

      if (levels.length === 0) {
        return {
          ok: false,
          message: "Add at least one class before switching to Customized.",
        };
      }

      const programName = school.name.trim();
      if (programName.length < 2) {
        return { ok: false, message: "Enter a school name before switching to Customized." };
      }

      await schoolService.updateSchool(schoolId, {
        type: "CUSTOMIZED",
        customProgram: {
          name: programName,
          classes: levels.map((classLevel) => ({
            classLevel,
            subjects: subjectsByClass.get(classLevel)?.length
              ? subjectsByClass.get(classLevel)!
              : (subjectsForClassLevel(classLevel) as Subject[]),
          })),
        },
      } as SchoolInput);
    } else {
      // Customized schools only have a custom program — map each class onto Regular catalog programs.
      let existingRegular = school.schoolPrograms
        .filter((program) => (program.type ?? "REGULAR") === "REGULAR")
        .map((program) => ({
          programId: program.programId,
          classes: program.classes
            .filter((row) => row.subjects.length > 0)
            .map((row) => ({ classLevel: row.classLevel, subjects: row.subjects as Subject[] })),
        }))
        .filter((row) => row.classes.length > 0);

      if (existingRegular.length === 0) {
        let organization: Awaited<ReturnType<typeof sectionService.listAdminSchoolSections>> | null =
          null;
        try {
          organization = await sectionService.listAdminSchoolSections(schoolId);
        } catch {
          organization = null;
        }

        const subjectsByClass = new Map<number, Subject[]>();
        for (const program of school.schoolPrograms) {
          for (const row of program.classes) {
            if (!subjectsByClass.has(row.classLevel) && row.subjects.length > 0) {
              subjectsByClass.set(row.classLevel, [...(row.subjects as Subject[])]);
            }
          }
        }

        const levels = [
          ...new Set([
            ...school.schoolPrograms.flatMap((program) =>
              program.classes.map((row) => row.classLevel),
            ),
            ...(organization?.wholeClasses ?? []).map((row) => row.classLevel),
            ...(organization?.sections ?? []).map((row) => row.classLevel),
          ]),
        ]
          .filter((level) => Number.isInteger(level) && level >= 1 && level <= 12)
          .sort((a, b) => a - b);

        const catalog = await programService.listAdminPrograms();
        existingRegular = seedRegularProgramsInput(catalog, levels, subjectsByClass);
        if (existingRegular.length === 0) {
          return {
            ok: false,
            message:
              levels.length === 0
                ? "Add at least one class before switching to Regular."
                : "No Regular catalog program covers this school's classes.",
          };
        }
      }

      await schoolService.updateSchool(schoolId, {
        type: "REGULAR",
        programs: existingRegular,
      } as SchoolInput);
    }

    revalidateSchoolPortalViews();
    revalidatePath(`${ADMIN_BASE_PATH}/schools/${schoolId}`, "layout");
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Could not update school type." };
  }
}

/** Classes & sections drafts from the school form — applied only on Save. */
async function applyPendingClassChanges(
  schoolId: string,
  schoolPrograms: SchoolProgramOffering[],
  formData: FormData,
) {
  const createsRaw = String(formData.get("pendingSectionCreates") ?? "").trim();
  const deletesRaw = String(formData.get("pendingSectionDeletes") ?? "").trim();
  if (!createsRaw && !deletesRaw) return;

  let creates: SectionInput[] = [];
  let deletes: string[] = [];
  try {
    if (createsRaw) creates = JSON.parse(createsRaw) as SectionInput[];
    if (deletesRaw) deletes = JSON.parse(deletesRaw) as string[];
  } catch {
    return;
  }

  const customProgramId =
    schoolPrograms.find((row) => row.type === "CUSTOMIZED")?.programId ??
    schoolPrograms[0]?.programId;

  for (const id of deletes) {
    if (!id || id.startsWith("draft-")) continue;
    await sectionService.deleteAdminSchoolSection(schoolId, id);
  }

  for (const row of creates) {
    const programId =
      !row.programId || row.programId === CUSTOM_DRAFT_PROGRAM_ID
        ? customProgramId
        : row.programId;
    if (!programId) continue;
    await sectionService.createAdminSchoolSection(schoolId, {
      classLevel: row.classLevel,
      name: row.name?.trim() || "A",
      programId,
      studentCount: row.studentCount,
    });
  }
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

/** Fails open like the email check: saving still rejects a duplicate school ID. */
export async function isSchoolCodeTakenAction(code: string, excludeId?: string): Promise<boolean> {
  const value = code.trim();
  if (!value || value.length > 64) return false;
  try {
    const { codeTaken } = await schoolService.getCodeAvailability(value, excludeId);
    return codeTaken;
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
