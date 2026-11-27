"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { SCHOOL_HOME_PATH } from "@/constants/auth";
import {
  clearSelectedHeadOfficeSchoolId,
  setSelectedHeadOfficeSchoolId,
} from "@/features/head-office-portal/selected-school";
import { createSchoolSession, deleteSchoolSession } from "@/features/school-auth/session";
import { ApiError } from "@/services/api-client";
import * as portal from "@/services/head-office-portal";

async function assumeSchool(schoolId: string) {
  const { token, expiresAt } = await portal.assumeHeadOfficeSchool(schoolId);
  await createSchoolSession(token, expiresAt);
  await setSelectedHeadOfficeSchoolId(schoolId);
}

function safeSchoolPath(path: string) {
  return path.startsWith("/school") ? path : SCHOOL_HOME_PATH;
}

/**
 * Select a school and open its workspace (teachers, students, classes, …).
 * Product rule: switcher = “which school am I operating?”
 */
export async function openHeadOfficeSchoolWorkspaceAction(
  schoolId: string,
  path: string = SCHOOL_HOME_PATH,
) {
  try {
    await assumeSchool(schoolId);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not open this school." };
  }
  redirect(safeSchoolPath(path));
}

/** @deprecated alias — prefer openHeadOfficeSchoolWorkspaceAction */
export async function selectHeadOfficeSchoolAction(schoolId: string) {
  return openHeadOfficeSchoolWorkspaceAction(schoolId, SCHOOL_HOME_PATH);
}

/** @deprecated alias */
export async function enterHeadOfficeSchoolAction(schoolId: string) {
  return openHeadOfficeSchoolWorkspaceAction(schoolId, SCHOOL_HOME_PATH);
}

/** @deprecated alias */
export async function openHeadOfficeSchoolSectionAction(schoolId: string, path: string) {
  return openHeadOfficeSchoolWorkspaceAction(schoolId, path);
}

/** Switch school while already in a workspace; keep the same section when possible. */
export async function switchHeadOfficeSchoolAction(schoolId: string, returnPath = SCHOOL_HOME_PATH) {
  return openHeadOfficeSchoolWorkspaceAction(schoolId, returnPath);
}

/** Leave workspace → portfolio (All schools). Keeps head office signed in. */
export async function leaveHeadOfficeSchoolAction() {
  await deleteSchoolSession();
  await clearSelectedHeadOfficeSchoolId();
  redirect("/head-office/schools");
}

export async function sendHeadOfficeSchoolCredentialsAction(schoolId: string) {
  try {
    const result = await portal.sendHeadOfficeSchoolCredentials(schoolId);
    revalidatePath(`/head-office/schools/${schoolId}`);
    return { ok: true as const, to: result.to };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "Could not send credentials." };
  }
}

export async function resetHeadOfficeSchoolPasswordAction(schoolId: string, password: string) {
  try {
    const result = await portal.resetHeadOfficeSchoolPassword(schoolId, password);
    revalidatePath(`/head-office/schools/${schoolId}`);
    return { ok: true as const, to: result.to };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "Could not reset password." };
  }
}

export async function updateHeadOfficeSchoolLoginEmailAction(
  schoolId: string,
  accountEmail: string,
) {
  try {
    const result = await portal.updateHeadOfficeSchoolLoginEmail(schoolId, accountEmail);
    revalidatePath(`/head-office/schools/${schoolId}`);
    revalidatePath("/head-office/schools");
    return { ok: true as const, accountEmail: result.accountEmail };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      const details = error.details;
      if (Array.isArray(details)) {
        const fieldMessage = details.find(
          (row) => row && typeof row === "object" && typeof (row as { message?: unknown }).message === "string",
        ) as { message: string } | undefined;
        if (fieldMessage?.message) {
          return { ok: false as const, message: fieldMessage.message };
        }
      }
      return { ok: false as const, message: error.message };
    }
    return { ok: false as const, message: "Could not update login email." };
  }
}
