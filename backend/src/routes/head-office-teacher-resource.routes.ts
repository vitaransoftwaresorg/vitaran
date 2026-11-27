import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import {
  deleteAdminHeadOfficeTeacherResource,
  getAdminHeadOfficeTeacherResourceFile,
  listAdminHeadOfficeTeacherResources,
  uploadAdminHeadOfficeTeacherResource,
} from "../controllers/head-office-teacher-resource.controller.js";
import { requireAdmin } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";

const headOfficeIdParams = z.object({ id: z.uuid() });
const slotParams = z.object({
  id: z.uuid(),
  programCode: z.string().trim().min(2).max(64),
  classLevel: z.coerce.number().int().min(1).max(10),
  subject: z.string().trim().min(2).max(64),
});

const readPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
}).single("file");

/** Admin: /head-offices/:id/teacher-resources */
export const adminHeadOfficeTeacherResourceRouter = Router({ mergeParams: true });
adminHeadOfficeTeacherResourceRouter.use(requireAdmin);
adminHeadOfficeTeacherResourceRouter.get(
  "/",
  validate(headOfficeIdParams, "params"),
  listAdminHeadOfficeTeacherResources,
);
adminHeadOfficeTeacherResourceRouter.put(
  "/",
  validate(headOfficeIdParams, "params"),
  readPdf,
  uploadAdminHeadOfficeTeacherResource,
);
adminHeadOfficeTeacherResourceRouter.get(
  "/:programCode/:classLevel/:subject",
  validate(slotParams, "params"),
  getAdminHeadOfficeTeacherResourceFile,
);
adminHeadOfficeTeacherResourceRouter.delete(
  "/:programCode/:classLevel/:subject",
  validate(slotParams, "params"),
  deleteAdminHeadOfficeTeacherResource,
);
