const API_URL_ENV = "NEXT_PUBLIC_API_URL";

/** Base URL for the Express API (`NEXT_PUBLIC_API_URL`). */
export function getApiUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!value) {
    throw new Error(`${API_URL_ENV} is not set`);
  }

  return value.replace(/\/$/, "");
}
