import { Router } from "express";
import { streamSchoolEvents, streamTeacherEvents } from "../controllers/live.controller.js";
import { requireSchool, requireTeacher } from "../middleware/authenticate.js";

/** Live updates for a signed-in school. */
export const schoolEventsRouter = Router();
schoolEventsRouter.use(requireSchool);
schoolEventsRouter.get("/", streamSchoolEvents);

/** Live updates for a signed-in teacher. */
export const teacherEventsRouter = Router();
teacherEventsRouter.use(requireTeacher);
teacherEventsRouter.get("/", streamTeacherEvents);
