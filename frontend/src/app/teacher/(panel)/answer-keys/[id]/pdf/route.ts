import { fileResponse } from "@/features/documents/file-response";
import { fetchTeacherAnswerKeyPdf } from "@/services/answer-keys";

export async function GET(
  request: Request,
  { params }: RouteContext<"/teacher/answer-keys/[id]/pdf">,
) {
  return fileResponse(
    request,
    await fetchTeacherAnswerKeyPdf((await params).id),
    "Answer key not found",
  );
}
