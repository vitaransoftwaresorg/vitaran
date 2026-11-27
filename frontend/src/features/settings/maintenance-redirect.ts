import "server-only";
import { redirect } from "next/navigation";
import { ApiError } from "@/services/api-client";

export const UNDER_MAINTENANCE_PATH = "/under-maintenance";

/** Portal APIs return 503 during maintenance — send users to the static notice instead of a broken page. */
export function redirectIfMaintenance(error: unknown): void {
  if (
    error instanceof ApiError &&
    error.status === 503 &&
    /under maintenance/i.test(error.message)
  ) {
    redirect(UNDER_MAINTENANCE_PATH);
  }
}
