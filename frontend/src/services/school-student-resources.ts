import "server-only";
import { schoolApi, schoolFetch } from "@/services/school-api";
import type { SchoolStudentResource } from "@/services/schools";

export function listSchoolPortalStudentResources() {
  return schoolApi<SchoolStudentResource[]>("/school/student-resources");
}

export function fetchSchoolPortalStudentResource(classLevel: number, subject: string) {
  return schoolFetch(
    `/school/student-resources/${classLevel}/${encodeURIComponent(subject)}`,
  );
}
