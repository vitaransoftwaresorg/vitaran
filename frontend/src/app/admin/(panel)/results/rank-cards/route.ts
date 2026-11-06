import { fileResponse } from "@/features/documents/file-response";
import { fetchRankCards } from "@/services/results";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const upstream = await fetchRankCards(query.get("set") ?? "", Number(query.get("class")), {
    roll: query.get("roll") || undefined,
    format: query.get("format") === "jpg" ? "jpg" : "pdf",
  });
  return fileResponse(request, upstream, "Rank card not found. Save the results first.");
}
