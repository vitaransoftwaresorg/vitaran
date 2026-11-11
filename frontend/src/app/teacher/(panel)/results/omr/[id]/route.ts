import { fileResponse } from "@/features/documents/file-response";
import { fetchScanImage } from "@/services/scans";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  const { id } = await params;
  const kind = new URL(request.url).searchParams.get("kind") ?? "preview";
  return fileResponse(request, await fetchScanImage("teacher", id, kind), "OMR not found");
}
