import { fileResponse } from "@/features/documents/file-response";
import { fetchTeacherStudentPdf } from "@/services/students";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return fileResponse(request, await fetchTeacherStudentPdf((await params).id), "Student not found");
}
