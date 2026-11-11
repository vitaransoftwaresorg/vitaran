import { fileResponse } from "@/features/documents/file-response";
import { fetchSchoolLogo } from "@/services/schools";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  const { id } = await params;
  return fileResponse(request, await fetchSchoolLogo(id), "School logo not found");
}
