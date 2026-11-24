import { NextResponse } from "next/server";
import { schoolFetch } from "@/services/school-api";

type Params = { programCode: string; classLevel: string; subject: string };

/** Proxies a school student-resource PDF for the signed-in school portal. */
export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const { programCode, classLevel, subject } = await context.params;
  const response = await schoolFetch(
    `/school/student-resources/${encodeURIComponent(programCode)}/${encodeURIComponent(classLevel)}/${encodeURIComponent(subject)}`,
  );
  if (!response.ok) {
    return NextResponse.json(
      { message: "Student resource not found" },
      { status: response.status },
    );
  }
  const headers = new Headers();
  const type = response.headers.get("content-type");
  const disposition = response.headers.get("content-disposition");
  if (type) headers.set("Content-Type", type);
  if (disposition) headers.set("Content-Disposition", disposition);
  headers.set("Cache-Control", "private, max-age=300");
  return new NextResponse(response.body, { status: 200, headers });
}
