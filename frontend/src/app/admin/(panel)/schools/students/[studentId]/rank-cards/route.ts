import { fileResponse } from "@/features/documents/file-response";
import { fetchAdminStudentRankCards } from "@/services/students";

export async function GET(request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  return fileResponse(
    request,
    await fetchAdminStudentRankCards((await params).studentId),
    "No subject-wise report cards yet",
  );
}
