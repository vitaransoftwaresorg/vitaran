"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { ApiError } from "@/services/api-client";
import { updateAdminSettings } from "@/services/settings";
import type { UpdateAppSettingsInput } from "@/types/settings";

export async function saveAdminSettingsAction(input: UpdateAppSettingsInput) {
  try {
    const settings = await updateAdminSettings(input);
    revalidatePath("/admin/settings");
    return { ok: true as const, settings };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "Could not save settings." };
  }
}