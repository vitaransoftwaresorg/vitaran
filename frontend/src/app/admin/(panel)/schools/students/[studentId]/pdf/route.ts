import { fileResponse } from "@/features/documents/file-response";
import { fetchAdminStudentPdf } from "@/services/students";

export async function GET(request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  return fileResponse(request, await fetchAdminStudentPdf((await params).studentId), "Student not found");
}
