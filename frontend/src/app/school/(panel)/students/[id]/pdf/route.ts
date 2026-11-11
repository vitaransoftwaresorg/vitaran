import { fileResponse } from "@/features/documents/file-response";
import { fetchSchoolStudentPdf } from "@/services/students";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return fileResponse(request, await fetchSchoolStudentPdf((await params).id), "Student not found");
}
