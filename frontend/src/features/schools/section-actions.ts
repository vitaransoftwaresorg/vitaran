"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { ADMIN_BASE_PATH, SCHOOL_BASE_PATH } from "@/constants/auth";
import { ApiError } from "@/services/api-client";
import * as sectionService from "@/services/sections";
import { listSchoolClassTeacherSlots } from "@/services/teachers";
import type { SectionInput } from "@/types/section";
import type { ClassTeacherSlot } from "@/types/teacher";

function revalidateSections(schoolId?: string) {
  revalidatePath(`${SCHOOL_BASE_PATH}/classes`, "layout");
  revalidatePath(SCHOOL_BASE_PATH, "layout");
  if (schoolId) {
    revalidatePath(`${ADMIN_BASE_PATH}/schools/${schoolId}`, "layout");
  }
}

export async function createSectionAction(input: SectionInput) {
  try {
    const result = await sectionService.createSchoolSection(input);
    revalidateSections();
    return { ok: true as const, result };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not create class/section." };
  }
}

export async function updateSectionAction(id: string, input: Partial<SectionInput>) {
  try {
    const section = await sectionService.updateSchoolSection(id, input);
    revalidateSections();
    return { ok: true as const, section };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not update section." };
  }
}

export async function deleteSectionAction(id: string) {
  try {
    await sectionService.deleteSchoolSection(id);
    revalidateSections();
    return { ok: true as const };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not delete section." };
  }
}

export async function updateWholeClassAction(
  id: string,
  input: { programId?: string; studentCount?: number },
) {
  try {
    const row = await sectionService.updateSchoolWholeClass(id, input);
    revalidateSections();
    return { ok: true as const, class: row };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not update class." };
  }
}

export async function deleteWholeClassAction(id: string) {
  try {
    await sectionService.deleteSchoolWholeClass(id);
    revalidateSections();
    return { ok: true as const };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not delete class." };
  }
}

export async function loadSchoolSectionsAction(): Promise<{
  organization: Awaited<ReturnType<typeof sectionService.listSchoolClassOrganization>>;
  strength: Awaited<ReturnType<typeof sectionService.getSchoolSectionStrength>>;
  classTeacherSlots: ClassTeacherSlot[];
}> {
  try {
    const [organization, strength, classTeacherSlots] = await Promise.all([
      sectionService.listSchoolClassOrganization(),
      sectionService.getSchoolSectionStrength(),
      listSchoolClassTeacherSlots(),
    ]);
    return { organization, strength, classTeacherSlots };
  } catch {
    return {
      organization: { wholeClasses: [], sections: [] },
      strength: { studentStrength: null, used: 0, remaining: null },
      classTeacherSlots: [],
    };
  }
}
