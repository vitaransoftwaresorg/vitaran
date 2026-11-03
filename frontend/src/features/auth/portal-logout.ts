"use server";

import { redirect } from "next/navigation";
import { deleteSchoolSession } from "@/features/school-auth/session";
import { deleteTeacherSession } from "@/features/teacher-auth/session";

/** Clears school and/or teacher cookies, then returns to the marketing site. */
export async function portalLogout() {
  await Promise.all([deleteSchoolSession(), deleteTeacherSession()]);
  redirect("/");
}
