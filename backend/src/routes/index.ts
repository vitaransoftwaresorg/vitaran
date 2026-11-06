import { Router } from "express";
import { getAdminDashboard } from "../controllers/dashboard.controller.js";
import { requireAdmin } from "../middleware/authenticate.js";
import {
  answerKeyRouter,
  schoolAnswerKeyRouter,
  teacherAnswerKeyRouter,
} from "./answer-key.routes.js";
import { authRouter } from "./auth.routes.js";
import { healthRouter } from "./health.routes.js";
import { adminEventsRouter, schoolEventsRouter, teacherEventsRouter } from "./live.routes.js";
import {
  resultRouter,
  schoolResultRouter,
  teacherResultRouter,
} from "./result.routes.js";
import { programCatalogRouter, programRouter } from "./program.routes.js";
import { schoolRouter } from "./school.routes.js";
import { adminSchoolSectionRouter, schoolSectionRouter } from "./section.routes.js";
import {
  adminSchoolStudentRouter,
  adminStudentRouter,
  schoolStudentRouter,
  teacherStudentRouter,
} from "./student.routes.js";
import { adminOmScanRouter, schoolOmScanRouter, teacherOmScanRouter } from "../scan/routes.js";
import { schoolTeacherRouter, teacherRouter } from "./teacher.routes.js";
import { adminSettingsRouter, publicSettingsRouter } from "./settings.routes.js";
import { blockIfMaintenance } from "../middleware/maintenance.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/settings", publicSettingsRouter);
apiRouter.use("/admin/settings", adminSettingsRouter);
apiRouter.get("/dashboard", requireAdmin, getAdminDashboard);
apiRouter.use("/schools", schoolRouter);
apiRouter.use("/schools/:schoolId/sections", adminSchoolSectionRouter);
apiRouter.use("/schools/:schoolId/students", adminSchoolStudentRouter);
apiRouter.use("/students", adminStudentRouter);
apiRouter.use("/programs", programRouter);
apiRouter.use("/catalog/programs", programCatalogRouter);
apiRouter.use("/teachers", teacherRouter);
apiRouter.use("/answer-keys", answerKeyRouter);
apiRouter.use("/results", resultRouter);
apiRouter.use("/school/teachers", blockIfMaintenance, schoolTeacherRouter);
apiRouter.use("/school/sections", blockIfMaintenance, schoolSectionRouter);
apiRouter.use("/school/students", blockIfMaintenance, schoolStudentRouter);
apiRouter.use("/school/answer-keys", blockIfMaintenance, schoolAnswerKeyRouter);
apiRouter.use("/school/results", blockIfMaintenance, schoolResultRouter);
apiRouter.use("/admin/events", adminEventsRouter);
apiRouter.use("/school/events", schoolEventsRouter);
apiRouter.use("/teacher/events", teacherEventsRouter);
apiRouter.use("/teacher/answer-keys", blockIfMaintenance, teacherAnswerKeyRouter);
apiRouter.use("/teacher/results", blockIfMaintenance, teacherResultRouter);
apiRouter.use("/teacher/students", blockIfMaintenance, teacherStudentRouter);
apiRouter.use("/omr-scans", adminOmScanRouter);
apiRouter.use("/school/omr-scans", blockIfMaintenance, schoolOmScanRouter);
apiRouter.use("/teacher/omr-scans", blockIfMaintenance, teacherOmScanRouter);
