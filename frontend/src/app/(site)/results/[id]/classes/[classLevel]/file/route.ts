import { fileResponse } from "@/features/documents/file-response";
import { fetchPublicResultSheetFile } from "@/services/results";
import { getPublicSettings } from "@/services/settings";

export async function GET(
  request: Request,
  { params }: RouteContext<"/results/[id]/classes/[classLevel]/file">,
) {
  const { resultsPublic } = await getPublicSettings();
  if (!resultsPublic) {
    return new Response("Results are private", { status: 403 });
  }

  const { id, classLevel } = await params;
  return fileResponse(
    request,
    await fetchPublicResultSheetFile(id, Number(classLevel)),
    "Result not found",
  );
}
