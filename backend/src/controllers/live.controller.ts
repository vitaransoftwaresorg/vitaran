import type { RequestHandler } from "express";
import type { SchoolAccountDto } from "../services/school.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { onContentChanged } from "../utils/content-events.js";

/** Proxies and load balancers drop idle connections; a comment line every 25s keeps it open. */
const HEARTBEAT_MS = 25_000;
const RETRY_MS = 5_000;

function streamContentEvents(res: Parameters<RequestHandler>[1], schoolId: string, req: Parameters<RequestHandler>[0]) {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(`retry: ${RETRY_MS}\n\n`);

  const unsubscribe = onContentChanged(({ kind, schoolId: targetSchoolId }) => {
    // `null` schoolId = broadcast (e.g. regular answer keys shared across schools).
    if (targetSchoolId && targetSchoolId !== schoolId) return;
    res.write(`event: change\ndata: ${JSON.stringify({ kind })}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

/** Server-sent events telling a signed-in school when its answer keys or results change. */
export const streamSchoolEvents: RequestHandler = (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  streamContentEvents(res, school.id, req);
};

/** Same stream for teachers — filtered to their school's content. */
export const streamTeacherEvents: RequestHandler = (req, res) => {
  const teacher = res.locals.teacher as TeacherAccountDto;
  streamContentEvents(res, teacher.school.id, req);
};
