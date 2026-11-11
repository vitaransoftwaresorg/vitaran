import "server-only";
import { z } from "zod";
import { ApiError } from "@/services/api-client";
import type { LoginCredentials, LoginFormState } from "./schema";

function loginErrorMessage(error: unknown): string {
  // 401 wrong credentials, 403 inactive account, 429 too many attempts.
  if (error instanceof ApiError && [401, 403, 429].includes(error.status)) {
    return error.message;
  }
  return "We couldn't sign you in right now. Please try again shortly.";
}

/**
 * Validates the shared login form and runs `signIn`.
 * Returns the form state to show on failure, or null once signed in (callers then redirect).
 */
export async function attemptLogin(
  formData: FormData,
  schema: z.ZodType<LoginCredentials>,
  signIn: (credentials: LoginCredentials) => Promise<void>,
): Promise<LoginFormState | null> {
  const identifier = String(formData.get("identifier") ?? "");
  const parsed = schema.safeParse({ identifier, password: formData.get("password") });

  if (!parsed.success) {
    return {
      identifier,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      submittedAt: Date.now(),
    };
  }

  try {
    await signIn(parsed.data);
    return null;
  } catch (error) {
    return { identifier, message: loginErrorMessage(error), submittedAt: Date.now() };
  }
}
