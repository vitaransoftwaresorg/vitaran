import { NextResponse } from "next/server";
import { z } from "zod";
import { buildApiUrl } from "@/services/api-client";

const idSchema = z.uuid();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return new NextResponse(null, { status: 400 });
  }

  const response = await fetch(buildApiUrl(`/schools/${id}/logo`), { cache: "no-store" });
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}
