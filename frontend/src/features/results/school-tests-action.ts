"use server";

import { listSchoolTests } from "@/services/answer-keys";
import type { SchoolTestOption } from "@/types/answer-key";

export async function loadSchoolTestsAction(schoolId: string): Promise<SchoolTestOption[]> {
  if (!schoolId) return [];
  return listSchoolTests(schoolId);
}
