export function googleErrorMessage(code: unknown): string | null {
  if (typeof code !== "string" || !code) return null;

  switch (code) {
    case "google-unlinked":
      return "This Google account isn't registered on Vitaran. Use the school or teacher email we issued.";
    case "google-inactive":
      return "This account is inactive.";
    case "Configuration":
      return "Google sign-in is unavailable right now. Use your email and password.";
    case "AccessDenied":
      return "Google sign-in was cancelled.";
    case "google":
      return "Google sign-in didn't complete. Try again, or use your password.";
    default:
      return null;
  }
}

export function googleErrorCode(message: string, status: number): string {
  if (status === 403) return "google-inactive";
  if (status === 503) return "Configuration";
  if (status === 401) return "google-unlinked";
  return "google";
}
