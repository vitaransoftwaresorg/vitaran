"use server";

import { listSchoolClasses } from "@/services/teachers";
import type { SchoolClassRow } from "@/types/teacher";

export async function loadSchoolClassesAction(): Promise<SchoolClassRow[]> {
  return listSchoolClasses();
}
