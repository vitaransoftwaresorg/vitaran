"use server";

import { listSchoolResultSets, listTeacherResultSets } from "@/services/results";
import type { ResultSet } from "@/types/result";

export async function loadSchoolPortalResultsAction(): Promise<ResultSet[]> {
  return listSchoolResultSets();
}

export async function loadTeacherPortalResultsAction(): Promise<ResultSet[]> {
  return listTeacherResultSets();
}
