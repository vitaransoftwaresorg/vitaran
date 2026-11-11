import { fileResponse } from "@/features/documents/file-response";
import { fetchClassResultPdf } from "@/services/results";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const upstream = await fetchClassResultPdf(query.get("set") ?? "", Number(query.get("class")), "teacher");
  return fileResponse(request, upstream, "No results saved for this class yet");
}
