import { fileResponse } from "@/features/documents/file-response";
import { fetchAdminAnswerKeyPdf } from "@/services/answer-keys";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return fileResponse(
    request,
    await fetchAdminAnswerKeyPdf((await params).id),
    "Answer key not found",
  );
}
