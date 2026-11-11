import { fileResponse } from "@/features/documents/file-response";
import { fetchSchoolStudentProfilesPdf } from "@/services/students";

export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.get("ids") ?? "";
  return fileResponse(request, await fetchSchoolStudentProfilesPdf(ids), "No students to print");
}
