import "server-only";

/**
 * Streams a file from the API through the app so session tokens never reach the browser.
 * `?download=1` saves the file instead of opening it.
 */
export function fileResponse(request: Request, upstream: Response, notFound: string): Response {
  if (!upstream.ok) {
    return new Response(notFound, { status: upstream.status === 401 ? 401 : 404 });
  }

  const disposition = upstream.headers.get("Content-Disposition") ?? "inline";
  const download = new URL(request.url).searchParams.has("download");

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": download ? disposition.replace(/^inline/, "attachment") : disposition,
      "Cache-Control": "private, no-store",
    },
  });
}
