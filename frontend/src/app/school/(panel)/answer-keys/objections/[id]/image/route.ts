import { fileResponse } from "@/features/documents/file-response";
import { fetchSchoolObjectionImage } from "@/services/answer-keys";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  const { id } = await params;
  return fileResponse(request, await fetchSchoolObjectionImage(id), "Image not found");
}
