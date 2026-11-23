import { revalidatePath } from "next/cache";
import {
  RESULTS_PATH,
  SCHOOL_RESULTS_PATH,
  TEACHER_RESULTS_PATH,
} from "@/features/results/constants";

/**
 * One roster → Students + Results (and school profile) must all drop stale RSC.
 * Call after any create / import / update / delete of students.
 */
export function revalidateAdminRoster(schoolId?: string) {
  revalidatePath("/admin/schools/students", "layout");
  revalidatePath(RESULTS_PATH, "layout");
  revalidatePath(`${RESULTS_PATH}/enter`, "page");
  if (schoolId) {
    revalidatePath(`/admin/schools/${schoolId}`, "layout");
    revalidatePath(`/admin/schools/${schoolId}/students`, "layout");
  }
}

export function revalidateSchoolRoster() {
  revalidatePath("/school/students", "layout");
  revalidatePath("/school/classes", "layout");
  revalidatePath(SCHOOL_RESULTS_PATH, "layout");
  revalidatePath(TEACHER_RESULTS_PATH, "layout");
}
