import { fileResponse } from "@/features/documents/file-response";
import { fetchTeacherResultSheetFile } from "@/services/results";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; classLevel: string }> },
) {
  const { id, classLevel } = await params;
  return fileResponse(
    request,
    await fetchTeacherResultSheetFile(id, Number(classLevel)),
    "Result not found",
  );
}
