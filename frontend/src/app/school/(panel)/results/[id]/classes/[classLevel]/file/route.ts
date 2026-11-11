import { fileResponse } from "@/features/documents/file-response";
import { fetchSchoolResultSheetFile } from "@/services/results";

export async function GET(
  request: Request,
  { params }: RouteContext<"/school/results/[id]/classes/[classLevel]/file">,
) {
  const { id, classLevel } = await params;
  return fileResponse(
    request,
    await fetchSchoolResultSheetFile(id, Number(classLevel)),
    "Result not found",
  );
}
