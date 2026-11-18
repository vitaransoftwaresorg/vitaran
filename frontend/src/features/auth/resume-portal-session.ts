"use server";

import {
  ADMIN_BASE_PATH,
  SCHOOL_HOME_PATH,
  TEACHER_HOME_PATH,
} from "@/constants/auth";
import { getAdminSession } from "@/features/admin-auth/session";
import { getSchoolSession } from "@/features/school-auth/session";
import { getTeacherSession } from "@/features/teacher-auth/session";

/**
 * If a valid portal cookie already exists, return where Log in should go
 * (skip email/password). Otherwise null → show the login form.
 */
export async function resumePortalSession(): Promise<string | null> {
  try {
    if (await getSchoolSession()) return SCHOOL_HOME_PATH;
    if (await getTeacherSession()) return TEACHER_HOME_PATH;
    if (await getAdminSession()) return ADMIN_BASE_PATH;
  } catch {
    // Network / API blip — fall through to the login form.
  }
  return null;
}
