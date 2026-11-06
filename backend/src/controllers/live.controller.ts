import type { RequestHandler } from "express";
import type { SchoolAccountDto } from "../services/school.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { onContentChanged } from "../utils/content-events.js";

/** Proxies drop idle SSE; ping often so Next/undici do not close the upstream. */
const HEARTBEAT_MS = 12_000;
const RETRY_MS = 3_000;

function streamContentEvents(
  res: Parameters<RequestHandler>[1],
  req: Parameters<RequestHandler>[0],
  schoolId: string | null,
) {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  // Avoid request timeouts holding the socket forever after the client leaves.
  req.socket.setTimeout(0);
  res.flushHeaders();

  let open = true;
  const write = (chunk: string) => {
    if (!open || res.writableEnded) return false;
    try {
      return res.write(chunk);
    } catch {
      open = false;
      return false;
    }
  };

  write(`: connected\n\n`);
  write(`retry: ${RETRY_MS}\n\n`);

  const unsubscribe = onContentChanged(({ kind, schoolId: targetSchoolId }) => {
    // Admin (`schoolId === null` listener) receives everything.
    // School/teacher only get their school or broadcast (`targetSchoolId === null`).
    if (schoolId && targetSchoolId && targetSchoolId !== schoolId) return;
    write(`event: change\ndata: ${JSON.stringify({ kind, schoolId: targetSchoolId })}\n\n`);
  });

  const heartbeat = setInterval(() => {
    if (!write(": ping\n\n")) {
      clearInterval(heartbeat);
      unsubscribe();
    }
  }, HEARTBEAT_MS);

  const cleanup = () => {
    if (!open) return;
    open = false;
    clearInterval(heartbeat);
    unsubscribe();
  };
  req.on("close", cleanup);
  res.on("close", cleanup);
  res.on("error", cleanup);
}

/** Admin — every content change from any school or catalog publish. */
export const streamAdminEvents: RequestHandler = (req, res) => {
  streamContentEvents(res, req, null);
};

/** Server-sent events telling a signed-in school when shared content changes. */
export const streamSchoolEvents: RequestHandler = (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  streamContentEvents(res, req, school.id);
};

/** Same stream for teachers — filtered to their school's content. */
export const streamTeacherEvents: RequestHandler = (req, res) => {
  const teacher = res.locals.teacher as TeacherAccountDto;
  streamContentEvents(res, req, teacher.school.id);
};
