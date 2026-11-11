"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  RETURN_TO_COOKIE,
  TEACHER_HOME_PATH,
} from "@/constants/auth";
import { attemptLogin } from "@/features/auth/attempt-login";
import type { LoginFormState } from "@/features/auth/schema";
import { schoolLoginSchema } from "@/features/school-auth/schema";
import { loginTeacher } from "@/services/auth";
import { createTeacherSession, deleteTeacherSession } from "./session";

export async function teacherLogin(
  _state: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const failure = await attemptLogin(formData, schoolLoginSchema, async (credentials) => {
    const { token, expiresAt } = await loginTeacher(credentials);
    await createTeacherSession(token, expiresAt);
  });
  if (failure) return failure;

  const cookieStore = await cookies();
  cookieStore.delete(RETURN_TO_COOKIE);
  redirect(TEACHER_HOME_PATH);
}

export async function teacherLogout() {
  await deleteTeacherSession();
  redirect("/");
}
