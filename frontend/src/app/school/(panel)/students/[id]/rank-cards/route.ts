import { fileResponse } from "@/features/documents/file-response";
import { fetchSchoolStudentRankCards } from "@/services/students";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return fileResponse(
    request,
    await fetchSchoolStudentRankCards((await params).id),
    "No subject-wise report cards yet",
  );
}
