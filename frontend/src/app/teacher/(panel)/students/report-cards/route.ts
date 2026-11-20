import { fileResponse } from "@/features/documents/file-response";
import { emptyReportMessage } from "@/features/students/report-messages";
import { fetchTeacherStudentsReportCards, type ReportCardKind } from "@/services/students";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const ids = (query.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  const kindParam = query.get("kind");
  const kind: ReportCardKind = kindParam === "year" || kindParam === "subjects" ? kindParam : "tests";
  const subject = query.get("subject")?.trim() || undefined;
  const testRaw = Number(query.get("test"));
  const test = Number.isInteger(testRaw) && testRaw >= 1 && testRaw <= 18 ? testRaw : undefined;
  return fileResponse(
    request,
    await fetchTeacherStudentsReportCards(ids, kind, subject, test),
    emptyReportMessage(kind, { subject, test }),
  );
}
