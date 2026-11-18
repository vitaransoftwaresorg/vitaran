import { redirect } from "next/navigation";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
import { fileResponse } from "@/features/documents/file-response";
import { fetchPublicAnswerKeyPdf } from "@/services/answer-keys";
import { getPublicSettings } from "@/services/settings";

export async function GET(
  request: Request,
  { params }: RouteContext<"/answer-keys/[id]/pdf">,
) {
  const { answerKeysPublic } = await getPublicSettings();
  if (!answerKeysPublic) {
    redirect(SCHOOL_LOGIN_PATH);
  }

  return fileResponse(
    request,
    await fetchPublicAnswerKeyPdf((await params).id),
    "Answer key not found",
  );
}
