import "server-only";
import { adminApi } from "@/services/admin-api";
import { apiClient } from "@/services/api-client";
import type { AppSettings, PublicSettings, UpdateAppSettingsInput } from "@/types/settings";

export function getPublicSettings() {
  return apiClient<PublicSettings>("/settings", { cache: "no-store" });
}

export function getAdminSettings() {
  return adminApi<AppSettings>("/admin/settings");
}

export function updateAdminSettings(input: UpdateAppSettingsInput) {
  return adminApi<AppSettings>("/admin/settings", {
    method: "PATCH",
    body: input,
  });
}
