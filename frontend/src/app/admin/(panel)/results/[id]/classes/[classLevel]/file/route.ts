import { fileResponse } from "@/features/documents/file-response";
import { fetchResultSheetFile } from "@/services/results";

export async function GET(request: Request, { params }: RouteContext<"/admin/results/[id]/classes/[classLevel]/file">) {
  const { id, classLevel } = await params;
  return fileResponse(request, await fetchResultSheetFile(id, Number(classLevel)), "Result not found");
}
