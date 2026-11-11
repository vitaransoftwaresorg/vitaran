import { fileResponse } from "@/features/documents/file-response";
import { fetchSchoolAnswerKeyPdf } from "@/services/answer-keys";

export async function GET(
  request: Request,
  { params }: RouteContext<"/school/answer-keys/[id]/pdf">,
) {
  return fileResponse(
    request,
    await fetchSchoolAnswerKeyPdf((await params).id),
    "Answer key not found",
  );
}
