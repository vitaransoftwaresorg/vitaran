export const ADMIN_SESSION_COOKIE = "vitaran_admin_session";
export const ADMIN_BASE_PATH = "/admin";
export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_LOGOUT_PATH = "/admin/logout";

export const SCHOOL_SESSION_COOKIE = "vitaran_school_session";
export const SCHOOL_BASE_PATH = "/school";
export const SCHOOL_LOGIN_PATH = "/school/login";
/** After school login — resources is the landing page. */
export const SCHOOL_HOME_PATH = "/school/resources";

export const TEACHER_SESSION_COOKIE = "vitaran_teacher_session";
export const TEACHER_BASE_PATH = "/teacher";
/** Same unified portal login as schools. */
export const TEACHER_LOGIN_PATH = SCHOOL_LOGIN_PATH;
/** After teacher login — resources is the landing page. */
export const TEACHER_HOME_PATH = "/teacher/resources";

/** Page the user tried to open before being sent to login; read once after signing in. */
export const RETURN_TO_COOKIE = "vitaran_return_to";

/** Which portal started Google OAuth (school/teacher only). */
export const GOOGLE_PORTAL_COOKIE = "vitaran_google_portal";
export const GOOGLE_COMPLETE_PATH = "/auth/google/complete";

/** Only same-site paths are allowed, so a return path can't send users to another origin. */
export function safeRedirectPath(value: unknown, fallback: string): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}

/** After portal login, only return to paths for that role (else home). */
export function safePortalReturnPath(
  value: unknown,
  role: "school" | "teacher",
  fallback: string,
): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  if (role === "school") {
    return value.startsWith("/school") && !value.startsWith("/school/login") ? value : fallback;
  }
  if (value.startsWith("/teacher")) return value;
  if (value.startsWith("/answer-keys")) return `/teacher${value}`;
  if (value.startsWith("/results")) return `/teacher${value}`;
  if (value.startsWith("/teachers-resources")) return "/teacher/resources";
  return fallback;
}
