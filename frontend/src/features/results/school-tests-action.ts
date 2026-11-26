"use server";

import { listSchoolTests } from "@/services/answer-keys";
import type { SchoolTestsForResults } from "@/types/answer-key";

export async function loadSchoolTestsAction(schoolId: string): Promise<SchoolTestsForResults> {
  if (!schoolId) return { tests: [], classSlots: [] };
  return listSchoolTests(schoolId);
}
