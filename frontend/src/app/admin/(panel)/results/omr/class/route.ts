import { fileResponse } from "@/features/documents/file-response";
import { fetchAdminClassScansPdf } from "@/services/scans";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const upstream = await fetchAdminClassScansPdf(
    {
      schoolId: query.get("school") ?? "",
      testNumber: Number(query.get("test")),
      classLevel: Number(query.get("class")),
      program: query.get("program") || undefined,
    },
    query.get("kind") ?? "preview",
  );
  return fileResponse(request, upstream, "No OMR sheets saved for this class yet");
}
