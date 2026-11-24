import "server-only";
import { schoolApi, schoolFetch } from "@/services/school-api";
import { teacherApi, teacherFetch } from "@/services/teacher-api";
import type { SchoolStudentResource } from "@/services/schools";

export function listSchoolPortalStudentResources() {
  return schoolApi<SchoolStudentResource[]>("/school/student-resources");
}

export function fetchSchoolPortalStudentResource(
  programCode: string,
  classLevel: number,
  subject: string,
) {
  return schoolFetch(
    `/school/student-resources/${encodeURIComponent(programCode)}/${classLevel}/${encodeURIComponent(subject)}`,
  );
}

export function listTeacherPortalStudentResources() {
  return teacherApi<SchoolStudentResource[]>("/teacher/student-resources");
}

export function fetchTeacherPortalStudentResource(
  programCode: string,
  classLevel: number,
  subject: string,
) {
  return teacherFetch(
    `/teacher/student-resources/${encodeURIComponent(programCode)}/${classLevel}/${encodeURIComponent(subject)}`,
  );
}
