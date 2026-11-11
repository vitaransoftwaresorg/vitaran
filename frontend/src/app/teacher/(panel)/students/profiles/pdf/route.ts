import { fileResponse } from "@/features/documents/file-response";
import { fetchTeacherStudentProfilesPdf } from "@/services/students";

export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.get("ids") ?? "";
  return fileResponse(request, await fetchTeacherStudentProfilesPdf(ids), "No students to print");
}
