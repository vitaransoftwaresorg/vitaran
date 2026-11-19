import { fileResponse } from "@/features/documents/file-response";
import { fetchSchoolStudentReportCard, type ReportCardKind } from "@/services/students";

function paramsOf(request: Request): { kind: ReportCardKind; subject?: string; test?: number } {
  const query = new URL(request.url).searchParams;
  const kind = query.get("kind");
  const subject = query.get("subject")?.trim() || undefined;
  const testRaw = Number(query.get("test"));
  const test = Number.isInteger(testRaw) && testRaw >= 1 && testRaw <= 18 ? testRaw : undefined;
  return {
    kind: kind === "year" || kind === "subjects" ? kind : "tests",
    subject,
    test,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { kind, subject, test } = paramsOf(request);
  return fileResponse(
    request,
    await fetchSchoolStudentReportCard((await params).id, kind, subject, test),
    "No report cards yet",
  );
}
