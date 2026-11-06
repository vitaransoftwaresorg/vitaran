import { apiClient } from "@/services/api-client";
import type { PublicSettings } from "@/types/settings";

/** Browser-side public settings (no auth). */
export function getPublicSettingsClient() {
  return apiClient<PublicSettings>("/settings", { cache: "no-store" });
}
