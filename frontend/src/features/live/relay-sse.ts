/** Shared headers for proxied Server-Sent Events. */
export const LIVE_STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/**
 * Pipe an upstream SSE body to the browser without turning a normal
 * disconnect / upstream restart into a 500 "failed to pipe response".
 */
export function relaySse(upstream: Response, clientSignal?: AbortSignal): Response {
  const body = upstream.body;
  if (!body) return new Response(null, { status: 502 });

  const reader = body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const onAbort = () => {
        void reader.cancel().catch(() => undefined);
      };
      clientSignal?.addEventListener("abort", onAbort, { once: true });
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch {
        try {
          controller.close();
        } catch {
          // Stream already closed by the client.
        }
      } finally {
        clientSignal?.removeEventListener("abort", onAbort);
        try {
          reader.releaseLock();
        } catch {
          // Already released.
        }
      }
    },
    cancel() {
      void reader.cancel().catch(() => undefined);
    },
  });

  return new Response(stream, { headers: LIVE_STREAM_HEADERS });
}
