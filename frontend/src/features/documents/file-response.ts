import "server-only";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function upstreamErrorMessage(upstream: Response, fallback: string) {
  try {
    const type = upstream.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const body = (await upstream.json()) as {
        message?: unknown;
        error?: unknown;
      };
      const nested =
        body.error && typeof body.error === "object"
          ? (body.error as { message?: unknown }).message
          : undefined;
      const message =
        typeof body.message === "string"
          ? body.message
          : typeof body.error === "string"
            ? body.error
            : typeof nested === "string"
              ? nested
              : "";
      if (message.trim()) return message.trim();
    } else {
      const text = (await upstream.text()).trim();
      if (text) return text;
    }
  } catch {
    // keep fallback
  }
  return fallback;
}

/**
 * Streams a file from the API through the app so session tokens never reach the browser.
 * `?download=1` saves the file instead of opening it.
 * Missing files return plain text (for toast fetch) and a simple HTML page when opened.
 */
export async function fileResponse(
  request: Request,
  upstream: Response,
  notFound: string,
): Promise<Response> {
  if (!upstream.ok) {
    const status = upstream.status === 401 ? 401 : 404;
    const message = await upstreamErrorMessage(upstream, notFound);
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/html") && !accept.includes("application/json")) {
      const safe = escapeHtml(message);
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${safe}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.5 system-ui,sans-serif;background:#f8fafc;color:#0f172a}main{max-width:28rem;padding:2rem;text-align:center}h1{margin:0 0 .5rem;font-size:1.125rem}p{margin:0;color:#64748b}</style></head><body><main><h1>${safe}</h1><p>Add or publish results, then try again.</p></main></body></html>`;
      return new Response(html, {
        status,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
      });
    }
    return new Response(message, {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
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
