import { Router } from "express";
import { z } from "zod";
import {
  assumePortalSchool,
  getPortalDashboard,
  getPortalSchool,
  listPortalSchools,
  resetPortalSchoolPassword,
  sendPortalSchoolCredentials,
  updatePortalSchoolLoginEmail,
} from "../controllers/head-office-portal.controller.js";
import { requireHeadOffice } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";

const schoolIdParams = z.object({ id: z.string().uuid() });
const resetPasswordBody = z.object({
  password: z.string().min(4, "Use at least 4 characters").max(128),
});
const loginEmailBody = z.object({
  accountEmail: z.string().trim().email("Enter a valid email").max(254),
});

export const headOfficePortalRouter = Router();

headOfficePortalRouter.use(requireHeadOffice);
headOfficePortalRouter.get("/dashboard", getPortalDashboard);
headOfficePortalRouter.get("/schools", listPortalSchools);
headOfficePortalRouter.get("/schools/:id", validate(schoolIdParams, "params"), getPortalSchool);
headOfficePortalRouter.post(
  "/schools/:id/session",
  validate(schoolIdParams, "params"),
  assumePortalSchool,
);
headOfficePortalRouter.post(
  "/schools/:id/send-credentials",
  validate(schoolIdParams, "params"),
  sendPortalSchoolCredentials,
);
headOfficePortalRouter.post(
  "/schools/:id/reset-password",
  validate(schoolIdParams, "params"),
  validate(resetPasswordBody),
  resetPortalSchoolPassword,
);
headOfficePortalRouter.patch(
  "/schools/:id/login-email",
  validate(schoolIdParams, "params"),
  validate(loginEmailBody),
  updatePortalSchoolLoginEmail,
);
