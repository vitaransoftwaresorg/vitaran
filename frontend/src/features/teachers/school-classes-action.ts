"use server";

import { listSchoolSections } from "@/services/sections";
import type { SchoolSection } from "@/types/section";

export async function loadSchoolClassesAction(): Promise<SchoolSection[]> {
  try {
    return await listSchoolSections();
  } catch {
    return [];
  }
}
