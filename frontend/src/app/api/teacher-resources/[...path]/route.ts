import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  SCHOOL_SESSION_COOKIE,
  TEACHER_SESSION_COOKIE,
} from "@/constants/auth";
import { fetchPublicRegularTeacherResource } from "@/services/regular-teacher-resources";
import { getPublicSettings } from "@/services/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

async function canView() {
  try {
    const { teacherResourcesPublic } = await getPublicSettings();
    if (teacherResourcesPublic) return true;
  } catch {
    // Fall through to session check.
  }
  const jar = await cookies();
  return (
    jar.has(SCHOOL_SESSION_COOKIE) ||
    jar.has(TEACHER_SESSION_COOKIE) ||
    jar.has(ADMIN_SESSION_COOKIE)
  );
}

/** Streams a DB-backed regular teacher-resource PDF for the in-app viewer. */
export async function GET(_request: Request, context: RouteContext) {
  if (!(await canView())) {
    return NextResponse.json({ message: "Sign in required to view this resource." }, { status: 401 });
  }

  const { path: parts } = await context.params;
  if (!parts || parts.length < 3) {
    return NextResponse.json({ message: "Resource not found." }, { status: 404 });
  }

  const programCode = decodeURIComponent(parts[0]!).toUpperCase();
  const classLevel = Number(parts[1]);
  const subject = decodeURIComponent(parts[2]!).toUpperCase();
  const volumePart = parts[3];
  const volume =
    volumePart && /^v?\d+$/i.test(volumePart)
      ? Number(volumePart.replace(/^v/i, ""))
      : 0;

  if (!programCode || !Number.isInteger(classLevel) || !subject) {
    return NextResponse.json({ message: "Resource not found." }, { status: 404 });
  }

  const response = await fetchPublicRegularTeacherResource(
    programCode,
    classLevel,
    subject,
    volume,
  );
  if (!response.ok) {
    return NextResponse.json(
      { message: response.status === 401 ? "Sign in required." : "Resource not found." },
      { status: response.status },
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "same-origin",
    },
  });
}
