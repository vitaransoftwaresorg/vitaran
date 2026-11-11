"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ADMIN_BASE_PATH,
  RETURN_TO_COOKIE,
  SCHOOL_HOME_PATH,
  TEACHER_HOME_PATH,
} from "@/constants/auth";
import { ApiError } from "@/services/api-client";
import { loginAdmin, loginSchool, loginTeacher } from "@/services/auth";
import { createAdminSession } from "@/features/admin-auth/session";
import { createSchoolSession } from "@/features/school-auth/session";
import { createTeacherSession } from "@/features/teacher-auth/session";
import { passwordField, type LoginFormState } from "./schema";

const portalLoginSchema = z.object({
  identifier: z.string().trim().min(1, { error: "Enter your email or phone number." }),
  password: passwordField,
});

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && [401, 403, 429].includes(error.status)) {
    return error.message;
  }
  return "We couldn't sign you in right now. Please try again shortly.";
}

const isWrongCredentials = (error: unknown) => error instanceof ApiError && error.status === 401;

/**
 * One login for schools, teachers and the admin.
 * Tries school, then teacher, then (for emails) admin; only wrong credentials fall through.
 */
export async function portalLogin(
  _state: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const identifier = String(formData.get("identifier") ?? "");
  const parsed = portalLoginSchema.safeParse({
    identifier,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      identifier,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      submittedAt: Date.now(),
    };
  }

  const credentials = parsed.data;
  let role: "school" | "teacher" | "admin";

  try {
    try {
      const { token, expiresAt } = await loginSchool(credentials);
      await createSchoolSession(token, expiresAt);
      role = "school";
    } catch (error) {
      if (!isWrongCredentials(error)) throw error;
      try {
        const { token, expiresAt } = await loginTeacher(credentials);
        await createTeacherSession(token, expiresAt);
        role = "teacher";
      } catch (teacherError) {
        if (!isWrongCredentials(teacherError) || !credentials.identifier.includes("@")) throw teacherError;
        try {
          const { token, expiresAt } = await loginAdmin({
            email: credentials.identifier.toLowerCase(),
            password: credentials.password,
          });
          await createAdminSession(token, expiresAt);
          role = "admin";
        } catch (adminError) {
          // The school/teacher wording keeps the admin account invisible on this page.
          throw isWrongCredentials(adminError) ? teacherError : adminError;
        }
      }
    }
  } catch (error) {
    return { identifier, message: loginErrorMessage(error), submittedAt: Date.now() };
  }

  const cookieStore = await cookies();
  cookieStore.delete(RETURN_TO_COOKIE);

  if (role === "admin") {
    redirect(ADMIN_BASE_PATH);
  }
  if (role === "teacher") {
    redirect(TEACHER_HOME_PATH);
  }
  redirect(SCHOOL_HOME_PATH);
}
