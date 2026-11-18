import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  SCHOOL_SESSION_COOKIE,
  TEACHER_SESSION_COOKIE,
} from "@/constants/auth";
import { resolveSolutionBookFile } from "@/features/teachers-resources/solution-book-file";
import { getPublicSettings } from "@/services/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

async function canViewSolutionBooks() {
  try {
    const { teacherResourcesPublic } = await getPublicSettings();
    if (teacherResourcesPublic) return true;
  } catch {
    // Fall through to session check if settings API is briefly unavailable.
  }
  const jar = await cookies();
  return (
    jar.has(SCHOOL_SESSION_COOKIE) ||
    jar.has(TEACHER_SESSION_COOKIE) ||
    jar.has(ADMIN_SESSION_COOKIE)
  );
}

/** Streams a solution-book PDF for the in-app viewer only (inline, no download name). */
export async function GET(_request: Request, context: RouteContext) {
  if (!(await canViewSolutionBooks())) {
    return NextResponse.json({ message: "Sign in required to view this resource." }, { status: 401 });
  }

  const { path: parts } = await context.params;
  const file = resolveSolutionBookFile(parts ?? []);
  if (!file || !existsSync(file)) {
    return NextResponse.json({ message: "Resource not found." }, { status: 404 });
  }

  const { size } = statSync(file);
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(size),
      // Inline only — never suggest a download filename.
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
